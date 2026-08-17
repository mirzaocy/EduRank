const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const notificationController = require('../controllers/notificationController');

router.get('/notifications', authenticateToken, notificationController.handleGetNotifications);
router.get('/notifications/unread-count', authenticateToken, notificationController.handleGetUnreadCount);
router.patch('/notifications/:id/read', authenticateToken, notificationController.handleMarkRead);
router.patch('/notifications/read-all', authenticateToken, notificationController.handleMarkAllRead);

module.exports = router;
