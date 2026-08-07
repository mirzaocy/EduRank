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

module.exports = {
    handleGetCheatLog,
    handleGetAllUsers,
    handleUpdateUserProfile,
    handleBanUser,
    handleDeleteUser
};
