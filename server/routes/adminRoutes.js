const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middlewares/authMiddleware');

router.get('/admin/cheat-log', requireAdmin, adminController.handleGetCheatLog);
router.get('/admin/users', requireAdmin, adminController.handleGetAllUsers);
router.post('/admin/update-profile', requireAdmin, adminController.handleUpdateUserProfile);
router.post('/admin/ban', requireAdmin, adminController.handleBanUser);
router.delete('/admin/users/:id', requireAdmin, adminController.handleDeleteUser);

module.exports = router;
