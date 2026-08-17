const jwt = require('jsonwebtoken');
const db = require('../config');
const { getJwtSecret } = require('../config/serverConfig');
const userModel = require('../models/userModel');
const { calculateELO } = require('../services/elo');
const {
    isRateLimited,
    cleanupSocket,
    registerSession,
    validateAnswerTiming,
    validateQuestionSync,
    hasAlreadyAnswered,
    logCheatEvent
} = require('../services/anticheat');
const {
    getRandomQuestions,
    checkAnswer,
    getQuestionData
} = require('../models/questions');
const {
    waitingPlayers,
    activeRooms,
    getEloSubject,
    validateMatchPayload
} = require('../services/matchService');

function initSockets(io) {
    io.use((socket, next) => {
        const token = socket.handshake.auth && socket.handshake.auth.token;
        if (!token) return next(new Error("Authentication error"));
        jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }, (err, user) => {
            if (err) return next(new Error("Authentication error"));
            db.get('SELECT banned FROM users WHERE id = ?', [user.id], (dbErr, dbUser) => {
                if (dbErr || !dbUser || dbUser.banned) {
                    return next(new Error("Authentication error"));
                }
                socket.user = user;
                next();
            });
        });
    });

    io.on('connection', (socket) => {
        console.log('User connected:', socket.user.email, 'Socket ID:', socket.id);

        const sessionCheck = registerSession(socket.user.id, socket.id);
        if (!sessionCheck.allowed) {
            const oldSocket = io.sockets.sockets.get(sessionCheck.existingSocketId);
            if (oldSocket) {
                oldSocket.emit('kicked', { reason: 'Sesi login baru terdeteksi di perangkat lain.' });
                oldSocket.disconnect(true);
            }
            registerSession(socket.user.id, socket.id);
            logCheatEvent(socket.user.id, socket.id, 'DUPLICATE_SESSION: Old session kicked');
        }

        socket.use((packet, next) => {
            if (isRateLimited(socket.id)) {
                logCheatEvent(socket.user.id, socket.id, 'RATE_LIMITED: Too many events');
                return next(new Error('Rate limited'));
            }
            next();
        });

        socket.on('joinMatchmaking', (payload) => {
            const validation = validateMatchPayload(payload);
            if (!validation.valid) {
                socket.emit('matchError', { reason: validation.reason });
                return;
            }

            const mode = validation.normalizedMode;
            const subject = validation.normalizedSubject;
            const eloSubject = getEloSubject(subject);
            const roomCode = validation.roomCode || 'GLOBAL';
            const settings = validation.settings || { questionCount: 5, timeLimitSeconds: 300 };
            const queue = waitingPlayers[mode];
            if (!queue) {
                socket.emit('matchError', { reason: 'INVALID_MODE' });
                return;
            }

            console.log(`User ${socket.user.email} joined matchmaking for ${mode} ${subject}${mode === 'friend' ? ` room=${roomCode}` : ''}`);

            waitingPlayers[mode] = queue.filter((p) => p.socketId !== socket.id && p.id !== socket.user.id);
            const activeQueue = waitingPlayers[mode];
            const existingIndex = activeQueue.findIndex(p => p.id === socket.user.id && p.roomCode === roomCode);
            if (existingIndex !== -1) return;

            const player = { socketId: socket.id, id: socket.user.id, subject, roomCode, settings };
            const matchIndex = activeQueue.findIndex(p => p.subject === subject && p.roomCode === roomCode);

            if (matchIndex !== -1) {
                const opponent = activeQueue.splice(matchIndex, 1)[0];
                const roomId = 'room_' + Math.random().toString(36).substr(2, 9);

                userModel.getMatchPlayers([player.id, opponent.id], eloSubject, (err, playerRows) => {
                        const rowsById = new Map((playerRows || []).map((row) => [Number(row.id), row]));
                        const p1Data = rowsById.get(Number(player.id));
                        const p2Data = rowsById.get(Number(opponent.id));
                        const opponentSocket = io.sockets.sockets.get(opponent.socketId);
                        if (err || !p1Data || !p2Data || !opponentSocket) {
                            socket.emit('matchError', { reason: 'PLAYER_NOT_FOUND' });
                            if (opponentSocket) opponentSocket.emit('matchError', { reason: 'PLAYER_NOT_FOUND' });
                            return;
                        }

                        const p1Full = { ...player, name: p1Data.name, avatar: p1Data.avatar, elo: p1Data.elo, score: 0, timeTaken: 0, answers: [] };
                        const p2Full = { ...opponent, name: p2Data.name, avatar: p2Data.avatar, elo: p2Data.elo, score: 0, timeTaken: 0, answers: [] };

                        const matchSettings = mode === 'friend' ? opponent.settings : settings;
                        const qCount = matchSettings.questionCount;
                        const baseTime = matchSettings.timeLimitSeconds;
                        const questions = getRandomQuestions(subject, qCount);

                        activeRooms[roomId] = {
                            id: roomId,
                            mode,
                            subject,
                            eloSubject,
                            roomCode,
                            p1: p1Full,
                            p2: p2Full,
                            questions,
                            currentQIndex: 0,
                            baseTime,
                            startTime: Date.now()
                        };

                        socket.join(roomId);
                        opponentSocket.join(roomId);

                        io.to(roomId).emit('matchFound', {
                            roomId,
                            p1: { name: p1Full.name, avatar: p1Full.avatar, elo: p1Full.elo },
                            p2: { name: p2Full.name, avatar: p2Full.avatar, elo: p2Full.elo },
                            subject,
                            roomCode,
                            questionsCount: qCount,
                            baseTime: activeRooms[roomId].baseTime
                        });

                        activeRooms[roomId].matchTimeout = setTimeout(() => endMatch(io, roomId), baseTime * 1000);

                        setTimeout(() => {
                            sendQuestion(io, roomId);
                        }, 3000);
                });

            } else {
                activeQueue.push(player);
                waitingPlayers[mode] = activeQueue;
                socket.emit('waitingForMatch');
            }
        });

        socket.on('leaveMatchmaking', (payload = {}) => {
            const { mode, roomCode } = payload || {};
            const normalizedMode = typeof mode === 'string' ? mode.toLowerCase() : '';
            const normalizedRoomCode = typeof roomCode === 'string' ? roomCode.trim().toUpperCase() : 'GLOBAL';
            if (waitingPlayers[normalizedMode]) {
                waitingPlayers[normalizedMode] = waitingPlayers[normalizedMode].filter((p) => {
                    if (p.id !== socket.user.id) return true;
                    if (normalizedMode === 'friend') {
                        return p.roomCode !== normalizedRoomCode;
                    }
                    return false;
                });
            }
        });

        socket.on('submitAnswer', (payload = {}) => {
            const { roomId, questionId, answerIndex } = payload || {};
            const room = activeRooms[roomId];
            if (!room) {
                socket.emit('matchError', { reason: 'ROOM_NOT_FOUND' });
                return;
            }

            if (hasAlreadyAnswered(room, socket.id)) {
                logCheatEvent(socket.user.id, socket.id, 'DOUBLE_ANSWER: Attempted to answer same question twice');
                return;
            }

            const syncCheck = validateQuestionSync(room, questionId);
            if (!syncCheck.valid) {
                logCheatEvent(socket.user.id, socket.id, syncCheck.reason);
                return;
            }

            const idx = parseInt(answerIndex);
            if (isNaN(idx) || idx < 0 || idx > 3) {
                logCheatEvent(socket.user.id, socket.id, `INVALID_INPUT: answerIndex=${answerIndex}`);
                return;
            }

            let playerObj = null;
            if (room.p1.socketId === socket.id) {
                playerObj = room.p1;
            } else if (room.p2.socketId === socket.id) {
                playerObj = room.p2;
            }
            if (!playerObj) return;

            const timingCheck = validateAnswerTiming(room, socket.id, playerObj);
            if (timingCheck.flag) {
                logCheatEvent(socket.user.id, socket.id, timingCheck.reason);
            }
            if (!timingCheck.valid) {
                socket.emit('answerReceived');
                playerObj.answers.push({ questionId, answerIndex: idx, isCorrect: false, flagged: true });
                if (room.p1.socketId === socket.id) room.p1Answered = true;
                else room.p2Answered = true;

                if (room.p1Answered && room.p2Answered) {
                    room.currentQIndex++;
                    setTimeout(() => sendQuestion(io, roomId), 2000);
                }
                return;
            }

            const timeTakenForQ = (Date.now() - room.questionStartTime) / 1000;
            const isCorrect = checkAnswer(questionId, idx);

            if (room.p1.socketId === socket.id) room.p1Answered = true;
            else room.p2Answered = true;

            playerObj.timeTaken += timeTakenForQ;
            playerObj.answers.push({ questionId, answerIndex: idx, isCorrect });
            if (isCorrect) playerObj.score += 10;

            if (room.p1Answered && room.p2Answered) {
                room.currentQIndex++;
                setTimeout(() => {
                    sendQuestion(io, roomId);
                }, 2000);
            } else {
                socket.emit('answerReceived');
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            waitingPlayers.ranked = waitingPlayers.ranked.filter(p => p.socketId !== socket.id);
            waitingPlayers.classic = waitingPlayers.classic.filter(p => p.socketId !== socket.id);
            waitingPlayers.friend = waitingPlayers.friend.filter(p => p.socketId !== socket.id);

            for (const [roomId, room] of Object.entries(activeRooms)) {
                if (room.p1.socketId === socket.id || room.p2.socketId === socket.id) {
                    const disconnectedIsP1 = room.p1.socketId === socket.id;
                    const winner = disconnectedIsP1 ? 'p2' : 'p1';
                    const loser = disconnectedIsP1 ? 'p1' : 'p2';

                    logCheatEvent(room[loser].id, socket.id, 'DISCONNECT_DURING_MATCH: Auto-loss applied');

                    const winnerELO = calculateELO(room[winner].score, room[loser].score, room[winner].timeTaken, room.baseTime, room.questions.length, room[winner].elo, true, room.mode);
                    const loserELO = calculateELO(room[loser].score, room[winner].score, room[loser].timeTaken, room.baseTime, room.questions.length, room[loser].elo, false, room.mode);

                    userModel.updateUserStats(room[winner].id, room.eloSubject, true, winnerELO.newTotal);
                    userModel.updateUserStats(room[loser].id, room.eloSubject, false, loserELO.newTotal);

                    const createdAt = new Date().toISOString();
                    // Persist winner history with details
                    const winnerDetails = (room[winner].answers || []).map((a) => {
                        const qd = getQuestionData(a.questionId) || {};
                        return {
                            questionId: a.questionId,
                            question: qd.q || null,
                            options: qd.options || null,
                            correctAnswer: qd.answer !== undefined ? qd.answer : null,
                            yourAnswer: a.answerIndex,
                            isCorrect: !!a.isCorrect,
                            flagged: !!a.flagged
                        };
                    });

                    userModel.recordMatchHistory({
                        userId: room[winner].id,
                        opponentName: room[loser].name,
                        subject: room.subject,
                        mode: room.mode,
                        isWin: true,
                        eloChange: winnerELO.gained,
                        createdAt,
                        durationSeconds: Math.floor(room[winner].timeTaken || 0),
                        details: winnerDetails
                    }, (err, winnerMatchId) => {
                        io.to(room[winner].socketId).emit('matchFinished', {
                            isWin: true,
                            score: room[winner].score,
                            oppScore: room[loser].score,
                            eloChange: winnerELO.gained,
                            newElo: winnerELO.newTotal,
                            timeTaken: room[winner].timeTaken,
                            matchId: winnerMatchId || null
                        });
                    });

                    // Persist loser history (no emit — client disconnected)
                    const loserDetails = (room[loser].answers || []).map((a) => {
                        const qd = getQuestionData(a.questionId) || {};
                        return {
                            questionId: a.questionId,
                            question: qd.q || null,
                            options: qd.options || null,
                            correctAnswer: qd.answer !== undefined ? qd.answer : null,
                            yourAnswer: a.answerIndex,
                            isCorrect: !!a.isCorrect,
                            flagged: !!a.flagged
                        };
                    });

                    userModel.recordMatchHistory({
                        userId: room[loser].id,
                        opponentName: room[winner].name,
                        subject: room.subject,
                        mode: room.mode,
                        isWin: false,
                        eloChange: loserELO.gained,
                        createdAt,
                        durationSeconds: Math.floor(room[loser].timeTaken || 0),
                        details: loserDetails
                    }, () => {});

                    if (room.matchTimeout) clearTimeout(room.matchTimeout);
                    delete activeRooms[roomId];
                    break;
                }
            }

            cleanupSocket(socket.id);
        });
    });

    function sendQuestion(io, roomId) {
        const room = activeRooms[roomId];
        if (!room) return;

        if (room.currentQIndex >= room.questions.length) {
            endMatch(io, roomId);
            return;
        }

        const q = room.questions[room.currentQIndex];
        room.questionStartTime = Date.now();
        room.p1Answered = false;
        room.p2Answered = false;

        io.to(roomId).emit('nextQuestion', {
            questionIndex: room.currentQIndex,
            totalQuestions: room.questions.length,
            question: q
        });
    }

    function endMatch(io, roomId) {
        const room = activeRooms[roomId];
        if (!room) return;

        if (room.matchTimeout) clearTimeout(room.matchTimeout);

        if (!room.p1 || !room.p2) {
            delete activeRooms[roomId];
            return;
        }

        let winner = 'draw';
        if (room.p1.score > room.p2.score) winner = 'p1';
        else if (room.p2.score > room.p1.score) winner = 'p2';
        else {
            if (room.p1.timeTaken < room.p2.timeTaken) winner = 'p1';
            else if (room.p2.timeTaken < room.p1.timeTaken) winner = 'p2';
        }

        const p1Win = winner === 'p1' ? true : (winner === 'draw' ? null : false);
        const p2Win = winner === 'p2' ? true : (winner === 'draw' ? null : false);

        const p1ELO = calculateELO(room.p1.score, room.p2.score, room.p1.timeTaken, room.baseTime, room.questions.length, room.p1.elo, p1Win, room.mode);
        const p2ELO = calculateELO(room.p2.score, room.p1.score, room.p2.timeTaken, room.baseTime, room.questions.length, room.p2.elo, p2Win, room.mode);

        userModel.updateUserStats(room.p1.id, room.eloSubject, p1Win, p1ELO.newTotal);
        userModel.updateUserStats(room.p2.id, room.eloSubject, p2Win, p2ELO.newTotal);

        // Persist histories and emit finish payloads including matchId when available
        const createdAt = new Date().toISOString();

        const p1Details = (room.p1.answers || []).map((a) => {
            const qd = getQuestionData(a.questionId) || {};
            return {
                questionId: a.questionId,
                question: qd.q || null,
                options: qd.options || null,
                correctAnswer: qd.answer !== undefined ? qd.answer : null,
                yourAnswer: a.answerIndex,
                isCorrect: !!a.isCorrect,
                flagged: !!a.flagged
            };
        });

        userModel.recordMatchHistory({
            userId: room.p1.id,
            opponentName: room.p2.name,
            subject: room.subject,
            mode: room.mode,
            isWin: p1Win === true,
            eloChange: p1ELO.gained,
            createdAt,
            durationSeconds: Math.floor(room.p1.timeTaken || 0),
            details: p1Details
        }, (err, p1MatchId) => {
            io.to(room.p1.socketId).emit('matchFinished', {
                isWin: p1Win,
                score: room.p1.score,
                oppScore: room.p2.score,
                eloChange: p1ELO.gained,
                newElo: p1ELO.newTotal,
                timeTaken: room.p1.timeTaken,
                matchId: p1MatchId || null
            });
        });

        const p2Details = (room.p2.answers || []).map((a) => {
            const qd = getQuestionData(a.questionId) || {};
            return {
                questionId: a.questionId,
                question: qd.q || null,
                options: qd.options || null,
                correctAnswer: qd.answer !== undefined ? qd.answer : null,
                yourAnswer: a.answerIndex,
                isCorrect: !!a.isCorrect,
                flagged: !!a.flagged
            };
        });

        userModel.recordMatchHistory({
            userId: room.p2.id,
            opponentName: room.p1.name,
            subject: room.subject,
            mode: room.mode,
            isWin: p2Win === true,
            eloChange: p2ELO.gained,
            createdAt,
            durationSeconds: Math.floor(room.p2.timeTaken || 0),
            details: p2Details
        }, (err, p2MatchId) => {
            io.to(room.p2.socketId).emit('matchFinished', {
                isWin: p2Win,
                score: room.p2.score,
                oppScore: room.p1.score,
                eloChange: p2ELO.gained,
                newElo: p2ELO.newTotal,
                timeTaken: room.p2.timeTaken,
                matchId: p2MatchId || null
            });
        });

        delete activeRooms[roomId];
    }
}

module.exports = {
    initSockets
};
