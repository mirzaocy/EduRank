const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { createRateLimiter } = require('../middlewares/rateLimitMiddleware');

router.post('/feedback', createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }), feedbackController.handleAddFeedback);

module.exports = router;
