const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

router.get('/health', healthController.handleHealthCheck);
router.get('/health/db', healthController.handleDbHealthCheck);

module.exports = router;
