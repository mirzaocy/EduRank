const db = require('../config');

function handleAddFeedback(req, res) {
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 120);
    const message = String(req.body?.message || '').trim().slice(0, 2_000);

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) {
        return res.status(400).json({ error: 'Name, a valid email address, and feedback are required.' });
    }

    db.addFeedback({ name, email, message, created_at: new Date().toISOString() });
    res.status(201).json({ message: 'Feedback received' });
}

module.exports = {
    handleAddFeedback
};
