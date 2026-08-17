const db = require('../config');

function createNotification(notification, callback) {
    const { recipientId, type, title, message, actorId, entityType, entityId, payload } = notification;
    const payloadJson = payload ? JSON.stringify(payload) : null;
    db.run(
        `INSERT INTO notifications (recipient_id, type, title, message, actor_id, entity_type, entity_id, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [recipientId, type, title || null, message || null, actorId || null, entityType || null, entityId || null, payloadJson],
        function (err) {
            if (callback) return callback(err, this && this.lastID ? this.lastID : null);
        }
    );
}

function getNotifications(userId, options = {}, callback) {
    const limit = Number(options.limit) || 20;
    const after = options.after || null; // cursor-based using created_at or id
    const unreadOnly = options.unread === true || options.unread === 'true';

    let sql = `SELECT id, recipient_id, type, title, message, actor_id, entity_type, entity_id, payload, is_read, created_at FROM notifications WHERE recipient_id = ?`;
    const params = [userId];
    if (unreadOnly) {
        sql += ` AND is_read = 0`;
    }
    if (after) {
        sql += ` AND id < ?`;
        params.push(after);
    }
    sql += ` ORDER BY id DESC LIMIT ?`;
    params.push(limit);

    db.all(sql, params, (err, rows) => {
        if (err) return callback(err);
        try {
            const parsed = (rows || []).map(r => ({ ...r, payload: r.payload ? JSON.parse(r.payload) : null }));
            callback(null, parsed);
        } catch (e) {
            callback(null, rows || []);
        }
    });
}

function getUnreadCount(userId, callback) {
    db.get(`SELECT COUNT(*) AS unread FROM notifications WHERE recipient_id = ? AND is_read = 0`, [userId], (err, row) => {
        if (err) return callback(err);
        callback(null, (row && row.unread) ? Number(row.unread) : 0);
    });
}

function markRead(userId, notificationId, callback) {
    db.run(`UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?`, [notificationId, userId], function (err) {
        if (callback) return callback(err, this && this.changes ? this.changes : 0);
    });
}

function markAllRead(userId, callback) {
    db.run(`UPDATE notifications SET is_read = 1 WHERE recipient_id = ? AND is_read = 0`, [userId], function (err) {
        if (callback) return callback(err, this && this.changes ? this.changes : 0);
    });
}

module.exports = {
    createNotification,
    getNotifications,
    getUnreadCount,
    markRead,
    markAllRead
};
