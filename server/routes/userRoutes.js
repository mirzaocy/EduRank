const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middlewares/authMiddleware');

router.get('/profile', authenticateToken, userController.handleGetProfile);
router.put('/profile', authenticateToken, userController.handleUpdateProfile);

router.get('/friends', authenticateToken, userController.handleGetFriends);
router.post('/friends', authenticateToken, userController.handleAddFriend);
router.delete('/friends/:friendId', authenticateToken, userController.handleDeleteFriend);

router.get('/leaderboard', userController.handleGetLeaderboard);
router.get('/battle-history', authenticateToken, userController.handleGetBattleHistory);

module.exports = router;
