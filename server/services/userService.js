const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const presenceService = require('./presenceService');
const db = require('../config');
const { getJwtSecret } = require('../config/serverConfig');

function getProfile(userId) {
    return new Promise((resolve) => {
        userModel.getUserProfile(userId, (err, user) => {
            if (err || !user) return resolve({ status: 404, error: "User not found" });
            resolve({ status: 200, data: user });
        });
    });
}

function updateProfile(userId, body) {
    const input = body || {};
    const limits = {
        name: 80,
        bio: 500,
        avatar: 1_500_000
    };
    const profile = Object.fromEntries(
        Object.entries(limits).map(([key, limit]) => [
            key,
            String(input[key] || '').trim().slice(0, limit)
        ])
    );

    if (!profile.name) {
        return Promise.resolve({ status: 400, error: "Name is required." });
    }

    if (profile.avatar && !/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(profile.avatar)) {
        return Promise.resolve({ status: 400, error: "Avatar must be an image upload." });
    }

    return new Promise((resolve) => {
        userModel.updateUserProfile(userId, profile, (err) => {
            if (err) return resolve({ status: 400, error: "Update failed." });
            resolve({ status: 200, data: { message: "Profile updated" } });
        });
    });
}

function getFriends(userId) {
    return new Promise((resolve) => {
        userModel.getFriendsList(userId, (err, rows) => {
            if (err) return resolve({ status: 500, error: "Database error" });
            // enrich with presence status if available
            const enriched = (rows || []).map(r => {
                const status = presenceService.getStatus(r.friend_user_id || r.id || r.friend_id) || r.status || 'Offline';
                return ({ ...r, status });
            });
            resolve({ status: 200, data: enriched });
        });
    });
}

function addFriend(userId, body) {
    const rawFriendId = body?.friendId;
    const rawUsername = String(body?.username || '').trim().toLowerCase();
    const friendId = Number(rawFriendId);

    return new Promise((resolve) => {
        const findFriendAndInsert = (lookupFn, param) => {
            lookupFn(param, (err, target) => {
                if (err) return resolve({ status: 500, error: "Database error" });
                if (!target || !target.id) return resolve({ status: 404, error: "Teman tidak ditemukan." });
                if (Number(target.id) === Number(userId)) return resolve({ status: 400, error: "Tidak bisa menambahkan diri sendiri." });

                userModel.checkFriendshipExists(userId, target.id, (existsErr, existing) => {
                    if (existsErr) return resolve({ status: 500, error: "Database error" });
                    if (existing) return resolve({ status: 400, error: "Teman sudah ada di daftar." });

                    userModel.addMutualFriendship(userId, target.id, (insertErr) => {
                        if (insertErr) return resolve({ status: 500, error: "Gagal menambahkan teman." });
                        resolve({ status: 201, data: { message: "Teman berhasil ditambahkan." } });
                    });
                });
            });
        };

        if (Number.isInteger(friendId) && friendId > 0) {
            return findFriendAndInsert(userModel.findFriendById, friendId);
        }

        if (rawUsername) {
            return findFriendAndInsert(userModel.findFriendByUsername, rawUsername);
        }

        resolve({ status: 400, error: "friendId atau username wajib diisi." });
    });
}

function deleteFriend(userId, friendIdParam) {
    const friendId = Number(friendIdParam);
    if (!Number.isInteger(friendId) || friendId <= 0) {
        return Promise.resolve({ status: 400, error: "Friend ID tidak valid." });
    }

    return new Promise((resolve) => {
        userModel.removeFriendship(userId, friendId, (err) => {
            if (err) return resolve({ status: 500, error: "Gagal menghapus teman." });
            resolve({ status: 200, data: { message: "Teman berhasil dihapus." } });
        });
    });
}

function getBattleHistory(userId) {
    return new Promise((resolve) => {
        userModel.getBattleHistory(userId, (err, rows) => {
            if (err) return resolve({ status: 500, error: "Database error" });
            resolve({ status: 200, data: rows || [] });
        });
    });
}

function getMatchDetail(userId, matchId) {
    const mid = Number(matchId);
    if (!Number.isInteger(mid) || mid <= 0) {
        return Promise.resolve({ status: 400, error: 'Invalid match id' });
    }
    return new Promise((resolve) => {
        userModel.getMatchDetail(mid, userId, (err, row) => {
            if (err) return resolve({ status: 500, error: 'Database error' });
            if (!row) return resolve({ status: 404, error: 'Match not found' });
            resolve({ status: 200, data: row });
        });
    });
}

function getLeaderboard(query, authHeader) {
    const allowedSubjects = ['matematika', 'fisika', 'informatika', 'bahasainggris', 'all'];
    const rawSubject = query.subject || 'all';
    const subject = allowedSubjects.includes(rawSubject) ? rawSubject : 'all';

    let orderBy = 'exp DESC';
    if (subject === 'all') {
        orderBy = '(elo_matematika + elo_fisika + elo_bahasainggris + elo_informatika) DESC';
    } else {
        orderBy = `elo_${subject} DESC`;
    }

    const region = query.region || 'Nasional';
    const token = authHeader && authHeader.split(' ')[1];
    let loggedInUser = null;
    if (token) {
        try {
            loggedInUser = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
        } catch (e) {}
    }

    return new Promise((resolve) => {
        const fetchLeaderboard = (userLocation = null) => {
            let whereClause = ' WHERE banned = 0 ';
            let queryParams = [];

            if (userLocation) {
                if (region === 'Provinsi' && userLocation.province && userLocation.province !== '-') {
                    whereClause += ' AND province = ? ';
                    queryParams.push(userLocation.province);
                } else if (region === 'Kota' && userLocation.city && userLocation.city !== '-') {
                    whereClause += ' AND city = ? ';
                    queryParams.push(userLocation.city);
                } else if (region === 'Sekolah' && userLocation.school && userLocation.school !== '-') {
                    whereClause += ' AND school = ? ';
                    queryParams.push(userLocation.school);
                } else if (region !== 'Nasional') {
                    return resolve({ status: 200, data: { error: "LOKASI_BELUM_VERIFIKASI" } });
                }
            } else if (region !== 'Nasional') {
                return resolve({ status: 200, data: { error: "LOKASI_BELUM_VERIFIKASI" } });
            }

            userModel.getLeaderboard(whereClause, orderBy, queryParams, (err, rows) => {
                if (err) return resolve({ status: 500, error: "Database error" });
                resolve({ status: 200, data: rows });
            });
        };

        if (loggedInUser && region !== 'Nasional') {
            userModel.findUserById(loggedInUser.id, (err, u) => {
                if (err || !u) {
                    fetchLeaderboard(null);
                } else {
                    fetchLeaderboard(u);
                }
            });
        } else {
            fetchLeaderboard(null);
        }
    });
}

function getAllUsers() {
    return new Promise((resolve) => {
        userModel.getAllUsers((err, rows) => {
            if (err) return resolve({ status: 500, error: "Database error" });
            const safeUsers = (rows || []).map(({ password: _password, ...user }) => user);
            resolve({ status: 200, data: safeUsers });
        });
    });
}

function adminUpdateUser(body) {
    const { id } = body || {};
    if (!id) return Promise.resolve({ status: 400, error: "User ID is required." });

    return new Promise((resolve) => {
        userModel.adminUpdateUser(body, (err) => {
            if (err) return resolve({ status: 400, error: "Failed to update profile details." });
            resolve({ status: 200, data: { message: "User details updated successfully." } });
        });
    });
}

function adminBanUser(body) {
    const { id, banned } = body || {};
    if (!id) return Promise.resolve({ status: 400, error: "User ID is required." });

    return new Promise((resolve) => {
        userModel.adminBanUser(Number(id), Boolean(banned), (err) => {
            if (err) return resolve({ status: 400, error: "Failed to update ban status." });
            resolve({ status: 200, data: { message: banned ? "User has been banned." : "User has been unbanned." } });
        });
    });
}

function adminDeleteUser(idParam) {
    const userId = Number(idParam);
    if (isNaN(userId)) return Promise.resolve({ status: 400, error: "Invalid user ID." });

    return new Promise((resolve) => {
        userModel.adminDeleteUser(userId, (err) => {
            if (err) return resolve({ status: 400, error: "Failed to delete user." });
            resolve({ status: 200, data: { message: "User account deleted successfully." } });
        });
    });
}

function getAdminStats() {
    return new Promise((resolve) => {
        const stats = {};
        db.get(`SELECT COUNT(*) AS totalUsers, SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins, SUM(CASE WHEN role = 'developer' THEN 1 ELSE 0 END) AS developers, SUM(CASE WHEN banned = 1 THEN 1 ELSE 0 END) AS bannedUsers, SUM(CASE WHEN status = 'Online' THEN 1 ELSE 0 END) AS onlineUsers, SUM(exp) AS totalExp, SUM(matches) AS totalBattles, SUM(wins) AS totalWins FROM users`, [], (err, userRow) => {
            if (err) return resolve({ status: 500, error: 'Database error' });
            db.get(`SELECT COUNT(*) AS totalFeedback FROM feedback`, [], (fErr, feedbackRow) => {
                if (fErr) return resolve({ status: 500, error: 'Database error' });
                db.get(`SELECT COUNT(*) AS unreadNotifications FROM notifications WHERE is_read = 0`, [], (nErr, notifRow) => {
                    if (nErr) return resolve({ status: 500, error: 'Database error' });
                    db.get(`SELECT COUNT(*) AS activeMatches FROM match_history WHERE created_at >= datetime('now', '-1 day')`, [], (mErr, matchRow) => {
                        if (mErr) return resolve({ status: 500, error: 'Database error' });
                        resolve({
                            status: 200,
                            data: {
                                totalUsers: userRow?.totalUsers || 0,
                                admins: userRow?.admins || 0,
                                developers: userRow?.developers || 0,
                                bannedUsers: userRow?.bannedUsers || 0,
                                onlineUsers: userRow?.onlineUsers || 0,
                                totalExp: userRow?.totalExp || 0,
                                totalBattles: userRow?.totalBattles || 0,
                                totalWins: userRow?.totalWins || 0,
                                totalFeedback: feedbackRow?.totalFeedback || 0,
                                unreadNotifications: notifRow?.unreadNotifications || 0,
                                activeMatches: matchRow?.activeMatches || 0
                            }
                        });
                    });
                });
            });
        });
    });
}

function searchAdminUsers(query = {}) {
    const term = String(query.q || '').trim();
    const role = String(query.role || 'all').trim().toLowerCase();
    const status = String(query.status || 'all').trim().toLowerCase();
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const params = [];
    let sql = `SELECT id, username, email, nama AS name, role, banned, status, last_login, created_at, updated_at, exp, matches, wins, province, city, school, class_level, avatar, rank_points FROM users WHERE 1=1`;

    if (term) {
        sql += ` AND (username LIKE ? OR email LIKE ? OR nama LIKE ? OR CAST(id AS TEXT) LIKE ?)`;
        const like = `%${term}%`;
        params.push(like, like, like, like);
    }
    if (role !== 'all') {
        sql += ` AND role = ?`;
        params.push(role);
    }
    if (status !== 'all') {
        if (status === 'online') sql += ` AND status = 'Online'`;
        else if (status === 'offline') sql += ` AND status != 'Online'`;
        else if (status === 'banned') sql += ` AND banned = 1`;
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return new Promise((resolve) => {
        db.all(sql, params, (err, rows) => {
            if (err) return resolve({ status: 500, error: 'Database error' });
            db.get(`SELECT COUNT(*) AS total FROM users WHERE 1=1`, [], (countErr, countRow) => {
                if (countErr) return resolve({ status: 500, error: 'Database error' });
                resolve({ status: 200, data: { items: rows || [], total: countRow?.total || 0 } });
            });
        });
    });
}

function getAdminUserById(idParam) {
    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) return Promise.resolve({ status: 400, error: 'Invalid user id.' });
    return new Promise((resolve) => {
        userModel.findUserById(id, (err, user) => {
            if (err) return resolve({ status: 500, error: 'Database error' });
            if (!user) return resolve({ status: 404, error: 'User not found' });
            const safe = { ...user };
            delete safe.password;
            resolve({ status: 200, data: safe });
        });
    });
}

function adminUpdateUserRole(idParam, body = {}, actor = {}) {
    const id = Number(idParam);
    const role = String(body.role || '').toLowerCase();
    if (!Number.isInteger(id) || id <= 0) return Promise.resolve({ status: 400, error: 'Invalid user id.' });
    if (!['siswa', 'admin', 'developer'].includes(role)) return Promise.resolve({ status: 400, error: 'Invalid role.' });
    if (role === 'developer' && actor.role !== 'developer') {
        return Promise.resolve({ status: 403, error: 'Only developer can assign developer role.' });
    }
    if (actor.role === 'admin' && role === 'developer') {
        return Promise.resolve({ status: 403, error: 'Admin cannot assign developer role.' });
    }
    return new Promise((resolve) => {
        db.run(`UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [role, id], function (err) {
            if (err) return resolve({ status: 500, error: 'Database error' });
            if (!this.changes) return resolve({ status: 404, error: 'User not found' });
            resolve({ status: 200, data: { message: 'Role updated', role } });
        });
    });
}

function getAdminBattles(query = {}) {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const subject = String(query.subject || '').trim().toLowerCase();
    const mode = String(query.mode || '').trim().toLowerCase();
    const params = [];
    let sql = `SELECT mh.id, mh.user_id, u.username AS player_username, u.nama AS player_name, mh.opponent_name, mh.subject, mh.mode, mh.is_win, mh.elo_change, mh.duration_seconds, mh.created_at FROM match_history mh LEFT JOIN users u ON u.id = mh.user_id WHERE 1=1`;
    if (subject) { sql += ` AND mh.subject = ?`; params.push(subject); }
    if (mode) { sql += ` AND mh.mode = ?`; params.push(mode); }
    sql += ` ORDER BY mh.created_at DESC, mh.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    return new Promise((resolve) => {
        db.all(sql, params, (err, rows) => {
            if (err) return resolve({ status: 500, error: 'Database error' });
            resolve({ status: 200, data: { items: rows || [] } });
        });
    });
}

function getAdminFeedback(query = {}) {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    return new Promise((resolve) => {
        db.all(`SELECT id, name, email, message, created_at FROM feedback ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
            if (err) return resolve({ status: 500, error: 'Database error' });
            resolve({ status: 200, data: { items: rows || [] } });
        });
    });
}

function getAdminNotifications(query = {}) {
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    return new Promise((resolve) => {
        db.all(`SELECT id, recipient_id, type, title, message, actor_id, entity_type, entity_id, is_read, created_at FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset], (err, rows) => {
            if (err) return resolve({ status: 500, error: 'Database error' });
            resolve({ status: 200, data: { items: rows || [] } });
        });
    });
}

function getAdminSystemStatus() {
    return new Promise((resolve) => {
        db.ping((err) => {
            resolve({
                status: 200,
                data: {
                    api: 'Online',
                    database: err ? 'Disconnected' : 'Connected',
                    realtime: 'Available',
                    environment: process.env.NODE_ENV || 'development',
                    nodeVersion: process.version
                }
            });
        });
    });
}

module.exports = {
    getProfile,
    updateProfile,
    getFriends,
    addFriend,
    deleteFriend,
    getBattleHistory,
    getMatchDetail,
    getLeaderboard,
    getAllUsers,
    adminUpdateUser,
    adminBanUser,
    adminDeleteUser,
    getAdminStats,
    searchAdminUsers,
    getAdminUserById,
    adminUpdateUserRole,
    getAdminBattles,
    getAdminFeedback,
    getAdminNotifications,
    getAdminSystemStatus
};
