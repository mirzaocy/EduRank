const userModel = require('../models/userModel');

const waitingPlayers = {
    ranked: [],
    classic: [],
    friend: []
};

const activeRooms = {};

function normalizeSubject(subject) {
    const allowed = ['matematika', 'fisika', 'bahasainggris', 'informatika', 'campuran'];
    return allowed.includes(subject) ? subject : 'campuran';
}

function getEloSubject(subject) {
    return subject === 'campuran' ? 'matematika' : subject;
}

function normalizeRoomCode(roomCode) {
    const raw = String(roomCode || '').trim().toUpperCase();
    return raw || 'GLOBAL';
}

function normalizeMatchSettings(settings) {
    const raw = settings && typeof settings === 'object' ? settings : {};
    const questionCount = Math.max(1, Math.min(10, Number.parseInt(raw.questions, 10) || 5));
    const timeMinutes = Math.max(1, Math.min(10, Number.parseInt(raw.time, 10) || 5));
    return { questionCount, timeLimitSeconds: timeMinutes * 60 };
}

function validateMatchPayload(payload) {
    const mode = payload && typeof payload.mode === 'string' ? payload.mode.toLowerCase() : '';
    const rawSubject = payload && typeof payload.subject === 'string' ? payload.subject.toLowerCase() : '';
    const subject = normalizeSubject(rawSubject || (mode === 'friend' ? 'campuran' : 'matematika'));
    const roomCode = normalizeRoomCode(payload && payload.roomCode);
    const settings = normalizeMatchSettings(payload && payload.settings);

    if (!['ranked', 'classic', 'friend'].includes(mode)) {
        return { valid: false, reason: 'INVALID_MODE' };
    }

    if (mode === 'friend') {
        return { valid: true, normalizedMode: mode, normalizedSubject: subject, roomCode, settings };
    }

    return { valid: true, normalizedMode: mode, normalizedSubject: subject };
}

function updatePlayerStats(userId, subject, isWin, newElo, score) {
    userModel.updateUserStats(userId, subject, isWin, newElo);
}

module.exports = {
    waitingPlayers,
    activeRooms,
    normalizeSubject,
    getEloSubject,
    normalizeRoomCode,
    normalizeMatchSettings,
    validateMatchPayload,
    updatePlayerStats
};
