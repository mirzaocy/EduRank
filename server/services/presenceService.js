const anticheat = require('./anticheat');
const userModel = require('../models/userModel');

// In-memory tracking: userId -> { sockets: Set(socketId), status }
const presence = new Map();

function setOnline(userId, socketId) {
    const entry = presence.get(userId) || { sockets: new Set(), status: 'Online' };
    entry.sockets.add(socketId);
    entry.status = 'Online';
    presence.set(userId, entry);
    // persist lightweight status
    userModel.setUserStatus(userId, 'Online', () => {});
}

function setOfflineBySocket(socketId) {
    for (const [userId, entry] of presence.entries()) {
        if (entry.sockets.has(socketId)) {
            entry.sockets.delete(socketId);
            if (entry.sockets.size === 0) {
                presence.delete(userId);
                userModel.setUserStatus(userId, 'Offline', () => {});
            } else {
                presence.set(userId, entry);
            }
            return Number(userId);
        }
    }
    return null;
}

function getStatus(userId) {
    const entry = presence.get(String(userId)) || presence.get(Number(userId));
    if (!entry) return 'Offline';
    return entry.status || 'Online';
}

function listOnline(userIds) {
    return (userIds || []).map(id => ({ id, status: getStatus(id) }));
}

module.exports = {
    setOnline,
    setOfflineBySocket,
    getStatus,
    listOnline,
    presence
};
