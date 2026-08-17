const notificationService = require('../services/notificationService');

function handleGetNotifications(req, res) {
    const userId = req.user.id;
    const limit = req.query.limit || 20;
    const after = req.query.after || null;
    const unread = req.query.unread === 'true' || req.query.unread === true;

    notificationService.getNotifications(userId, { limit, after, unread }, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(200).json(rows || []);
    });
}

function handleGetUnreadCount(req, res) {
    const userId = req.user.id;
    notificationService.getUnreadCount(userId, (err, count) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(200).json({ unread: count || 0 });
    });
}

function handleMarkRead(req, res) {
    const userId = req.user.id;
    const nid = Number(req.params.id);
    if (!Number.isInteger(nid) || nid <= 0) return res.status(400).json({ error: 'Invalid notification id' });
    notificationService.markRead(userId, nid, (err, changes) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!changes) return res.status(404).json({ error: 'Notification not found' });
        res.status(200).json({ success: true });
    });
}

function handleMarkAllRead(req, res) {
    const userId = req.user.id;
    notificationService.markAllRead(userId, (err, changes) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(200).json({ success: true, changed: changes || 0 });
    });
}

module.exports = {
    handleGetNotifications,
    handleGetUnreadCount,
    handleMarkRead,
    handleMarkAllRead
};
