const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/authMiddleware');
const tournamentController = require('../controllers/tournamentController');

router.get('/tournaments', tournamentController.handleList);
router.get('/tournaments/:id', tournamentController.handleGet);
router.post('/tournaments/:id/join', authenticateToken, tournamentController.handleJoin);
router.post('/tournaments/:id/leave', authenticateToken, tournamentController.handleLeave);

module.exports = router;
