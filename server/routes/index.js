const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const adminRoutes = require('./adminRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const healthRoutes = require('./healthRoutes');

router.use('/', healthRoutes);
router.use('/api', authRoutes);
router.use('/api', userRoutes);
router.use('/api', adminRoutes);
router.use('/api', feedbackRoutes);

module.exports = router;
