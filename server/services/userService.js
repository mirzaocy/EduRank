const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
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
            resolve({ status: 200, data: rows || [] });
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

module.exports = {
    getProfile,
    updateProfile,
    getFriends,
    addFriend,
    deleteFriend,
    getBattleHistory,
    getLeaderboard,
    getAllUsers,
    adminUpdateUser,
    adminBanUser,
    adminDeleteUser
};
