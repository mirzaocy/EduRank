const { getCheatLog } = require('../services/anticheat');
const userService = require('../services/userService');
const { sendServiceResult } = require('./response');

function handleGetCheatLog(req, res) {
    res.json(getCheatLog());
}

async function handleGetAllUsers(req, res) {
    const result = await userService.getAllUsers();
    return sendServiceResult(res, result);
}

async function handleUpdateUserProfile(req, res) {
    const result = await userService.adminUpdateUser(req.body);
    return sendServiceResult(res, result);
}

async function handleBanUser(req, res) {
    const result = await userService.adminBanUser(req.body);
    return sendServiceResult(res, result);
}

async function handleDeleteUser(req, res) {
    const result = await userService.adminDeleteUser(req.params.id);
    return sendServiceResult(res, result);
}

async function handleGetStats(req, res) {
    const result = await userService.getAdminStats();
    return sendServiceResult(res, result);
}

async function handleSearchUsers(req, res) {
    const result = await userService.searchAdminUsers(req.query);
    return sendServiceResult(res, result);
}

async function handleGetUser(req, res) {
    const result = await userService.getAdminUserById(req.params.id);
    return sendServiceResult(res, result);
}

async function handleUpdateUserRole(req, res) {
    const result = await userService.adminUpdateUserRole(req.params.id, req.body, req.user);
    return sendServiceResult(res, result);
}

async function handleGetBattles(req, res) {
    const result = await userService.getAdminBattles(req.query);
    return sendServiceResult(res, result);
}

async function handleGetFeedback(req, res) {
    const result = await userService.getAdminFeedback(req.query);
    return sendServiceResult(res, result);
}

async function handleGetNotifications(req, res) {
    const result = await userService.getAdminNotifications(req.query);
    return sendServiceResult(res, result);
}

async function handleGetSystem(req, res) {
    const result = await userService.getAdminSystemStatus();
    return sendServiceResult(res, result);
}

module.exports = {
    handleGetCheatLog,
    handleGetAllUsers,
    handleUpdateUserProfile,
    handleBanUser,
    handleDeleteUser,
    handleGetStats,
    handleSearchUsers,
    handleGetUser,
    handleUpdateUserRole,
    handleGetBattles,
    handleGetFeedback,
    handleGetNotifications,
    handleGetSystem
};
