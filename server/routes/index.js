const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const adminRoutes = require('./adminRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const healthRoutes = require('./healthRoutes');
const notificationRoutes = require('./notificationRoutes');
const tournamentRoutes = require('./tournamentRoutes');

router.use('/', healthRoutes);
router.use('/api', authRoutes);
router.use('/api', userRoutes);
router.use('/api', adminRoutes);
router.use('/api', feedbackRoutes);
router.use('/api', notificationRoutes);
router.use('/api', tournamentRoutes);

module.exports = router;
