const userService = require('../services/userService');
const { sendServiceResult } = require('./response');

async function handleGetProfile(req, res) {
    const result = await userService.getProfile(req.user.id);
    return sendServiceResult(res, result);
}

async function handleUpdateProfile(req, res) {
    const result = await userService.updateProfile(req.user.id, req.body);
    return sendServiceResult(res, result);
}

async function handleGetFriends(req, res) {
    const result = await userService.getFriends(req.user.id);
    return sendServiceResult(res, result);
}

async function handleAddFriend(req, res) {
    const result = await userService.addFriend(req.user.id, req.body);
    return sendServiceResult(res, result);
}

async function handleDeleteFriend(req, res) {
    const result = await userService.deleteFriend(req.user.id, req.params.friendId);
    return sendServiceResult(res, result);
}

async function handleGetLeaderboard(req, res) {
    const result = await userService.getLeaderboard(req.query, req.headers['authorization']);
    return sendServiceResult(res, result);
}

async function handleGetBattleHistory(req, res) {
    const result = await userService.getBattleHistory(req.user.id);
    return sendServiceResult(res, result);
}

module.exports = {
    handleGetProfile,
    handleUpdateProfile,
    handleGetFriends,
    handleAddFriend,
    handleDeleteFriend,
    handleGetLeaderboard,
    handleGetBattleHistory
};
