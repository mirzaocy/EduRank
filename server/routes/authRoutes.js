const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { createRateLimiter } = require('../middlewares/rateLimitMiddleware');

const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

router.post('/register', authLimiter, authController.handleRegister);
router.post('/login', authLimiter, authController.handleLogin);

module.exports = router;
