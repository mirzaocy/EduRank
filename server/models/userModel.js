const db = require('../config');

function findUserByEmail(email, callback) {
    db.get(`SELECT * FROM users WHERE email = ?`, [email], callback);
}

function findUserById(id, callback) {
    db.get(`SELECT * FROM users WHERE id = ?`, [id], callback);
}

function getMatchPlayers(ids, subject, callback) {
    const allowedSubjects = ['matematika', 'fisika', 'bahasainggris', 'informatika'];
    if (!allowedSubjects.includes(subject) || !Array.isArray(ids) || ids.length !== 2) {
        return callback(new Error('Invalid match player lookup.'), []);
    }
    db.all(
        `SELECT id, nama AS name, avatar, elo_${subject} AS elo FROM users WHERE id IN (?, ?)`,
        ids,
        callback
    );
}

function createUser(userData, callback) {
    const { username, email, hashedPassword, nama, safeBirthDate, photoUrl, role } = userData;
    db.run(
        `INSERT INTO users (username, email, password, nama, tanggal_lahir, foto, role, bio, avatar, student_photo, student_card_photo, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            username,
            email,
            hashedPassword,
            nama,
            safeBirthDate,
            photoUrl,
            role || 'siswa',
            null,
            null,
            photoUrl,
            userData.studentCardPhotoUrl || photoUrl,
            'Offline'
        ],
        callback
    );
}

function countAdminUsers(callback) {
    db.get(`SELECT COUNT(*) AS adminCount FROM users WHERE role = 'admin'`, [], callback);
}

function getUserProfile(id, callback) {
    db.get(
        `SELECT id, username, email, nama AS name, bio, country, province, city, class_level, school, avatar, exp, matches, wins, elo_matematika, elo_fisika, elo_bahasainggris, elo_informatika, highest_matematika, highest_fisika, highest_bahasainggris, highest_informatika, foto, student_photo, student_card_photo, banned, role, tanggal_lahir, rank_points, status 
         FROM users WHERE id = ?`,
        [id],
        callback
    );
}

function updateUserProfile(id, profile, callback) {
    db.run(
        `UPDATE users SET nama = ?, bio = ?, avatar = ?, foto = COALESCE(?, foto) WHERE id = ?`,
        [profile.name, profile.bio, profile.avatar || null, profile.avatar || null, id],
        callback
    );
}

function getFriendsList(userId, callback) {
    db.all(
        `SELECT f.id, f.user_id, f.friend_id, f.created_at,
                u.id AS friend_user_id, u.username, u.nama AS name, u.avatar, u.country, u.city, u.school, u.class_level,
                u.exp, u.matches, u.wins,
                (u.elo_matematika + u.elo_fisika + u.elo_bahasainggris + u.elo_informatika) AS total_elo
         FROM friends f
         JOIN users u ON u.id = f.friend_id
         WHERE f.user_id = ?
         ORDER BY f.created_at DESC`,
        [userId],
        callback
    );
}

function findFriendById(friendId, callback) {
    db.get(`SELECT id FROM users WHERE id = ?`, [friendId], callback);
}

function findFriendByUsername(username, callback) {
    db.get(`SELECT id FROM users WHERE username = ?`, [username], callback);
}

function checkFriendshipExists(userId, friendId, callback) {
    db.get(
        `SELECT id FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?) LIMIT 1`,
        [userId, friendId, friendId, userId],
        callback
    );
}

function addFriendship(userId, friendId, callback) {
    db.run(`INSERT INTO friends (user_id, friend_id) VALUES (?, ?)`, [userId, friendId], callback);
}

function addMutualFriendship(userId, friendId, callback) {
    addFriendship(userId, friendId, (err) => {
        if (err) return callback(err);
        addFriendship(friendId, userId, (reverseErr) => {
            if (reverseErr && reverseErr.code === 'ER_DUP_ENTRY') {
                return callback(null);
            }
            return callback(reverseErr);
        });
    });
}

function removeFriendship(userId, friendId, callback) {
    db.run(`DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`, [userId, friendId, friendId, userId], callback);
}

function updateUserStats(userId, subject, isWin, newElo, callback) {
    const expGained = 20 + (isWin === true ? 30 : 0);
    const winAdd = isWin === true ? 1 : 0;
    db.run(
        `UPDATE users SET 
            exp = exp + ?, 
            matches = matches + 1, 
            wins = wins + ?, 
            elo_${subject} = ? 
            WHERE id = ?`,
        [expGained, winAdd, newElo, userId],
        callback
    );
}

function recordMatchHistory(data, callback) {
    const { userId, opponentName, subject, mode, isWin, eloChange, createdAt, durationSeconds } = data;
    db.run(
        `INSERT INTO match_history (user_id, opponent_name, subject, mode, is_win, elo_change, duration_seconds, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, opponentName, subject, mode, isWin ? 1 : 0, eloChange, Number(durationSeconds) || 0, createdAt],
        callback
    );
}

function getBattleHistory(userId, callback) {
    db.all(
        `SELECT id, opponent_name, subject, mode, is_win, elo_change, duration_seconds, created_at
         FROM match_history
         WHERE user_id = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 20`,
        [userId],
        callback
    );
}

function getLeaderboard(whereClause, orderBy, queryParams, callback) {
    db.all(
        `SELECT id, name, username, country, province, city, school, avatar, elo_matematika, elo_fisika, elo_bahasainggris, 
                elo_informatika, wins, matches, 
                (elo_matematika + elo_fisika + elo_bahasainggris + elo_informatika) as total_elo 
         FROM users ${whereClause} ORDER BY ${orderBy} LIMIT 100`,
        queryParams,
        callback
    );
}

function getAllUsers(callback) {
    db.all(
        `SELECT id, username, email, nama AS name, rank_points, created_at, tanggal_lahir, foto, role, last_login, updated_at, bio, status, avatar, exp, elo_matematika, elo_fisika, elo_informatika, elo_bahasainggris, highest_matematika, highest_fisika, highest_informatika, highest_bahasainggris, matches, wins, country, city, province, class_level, school, banned, student_photo, student_card_photo FROM users`,
        [],
        callback
    );
}

function adminUpdateUser(data, callback) {
    const { id, username, province, city, school, class_level } = data;
    db.run(
        `UPDATE users SET username = ?, province = ?, city = ?, school = ?, class_level = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [
            String(username || '-').trim(), 
            String(province || '-').trim(), 
            String(city || '-').trim(), 
            String(school || '-').trim(), 
            String(class_level || '-').trim(), 
            Number(id)
        ],
        callback
    );
}

function adminBanUser(id, banned, callback) {
    db.run(
        `UPDATE users SET banned = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [banned ? 1 : 0, banned ? 'Banned' : 'Offline', Number(id)],
        callback
    );
}

function adminDeleteUser(id, callback) {
    db.run(`DELETE FROM users WHERE id = ?`, [Number(id)], callback);
}

module.exports = {
    findUserByEmail,
    findUserById,
    getMatchPlayers,
    createUser,
    getUserProfile,
    updateUserProfile,
    getFriendsList,
    findFriendById,
    findFriendByUsername,
    checkFriendshipExists,
    addFriendship,
    addMutualFriendship,
    removeFriendship,
    updateUserStats,
    recordMatchHistory,
    getBattleHistory,
    getLeaderboard,
    getAllUsers,
    countAdminUsers,
    adminUpdateUser,
    adminBanUser,
    adminDeleteUser
};
