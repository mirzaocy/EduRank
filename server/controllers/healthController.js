const db = require('../config');

function handleHealthCheck(req, res) {
    res.json({ status: 'ok' });
}

function handleDbHealthCheck(req, res) {
    db.ping((err) => {
        if (err) {
            return res.status(500).json({ status: 'error', error: 'Database unavailable' });
        }
        res.json({ status: 'ok' });
    });
}

module.exports = {
    handleHealthCheck,
    handleDbHealthCheck
};
