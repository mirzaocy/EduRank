const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin, requireDeveloper } = require('../middlewares/authMiddleware');

router.get('/admin/stats', requireAdmin, adminController.handleGetStats);
router.get('/admin/users', requireAdmin, adminController.handleSearchUsers);
router.get('/admin/users/:id', requireAdmin, adminController.handleGetUser);
router.put('/admin/users/:id', requireAdmin, adminController.handleUpdateUserProfile);
router.patch('/admin/users/:id/role', requireDeveloper, adminController.handleUpdateUserRole);
router.patch('/admin/users/:id/status', requireAdmin, adminController.handleBanUser);
router.delete('/admin/users/:id', requireDeveloper, adminController.handleDeleteUser);
router.get('/admin/battles', requireAdmin, adminController.handleGetBattles);
router.get('/admin/feedback', requireAdmin, adminController.handleGetFeedback);
router.get('/admin/notifications', requireAdmin, adminController.handleGetNotifications);
router.get('/admin/system', requireAdmin, adminController.handleGetSystem);
router.get('/admin/cheat-log', requireAdmin, adminController.handleGetCheatLog);

module.exports = router;
