const tournamentService = require('../services/tournamentService');

async function handleList(req, res) {
    const status = req.query.status || null;
    tournamentService.listTournaments({ status }, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(200).json(rows || []);
    });
}

async function handleGet(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid tournament id' });
    tournamentService.getTournament(id, (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Not found' });
        res.status(200).json(row);
    });
}

async function handleJoin(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid tournament id' });
    const userId = req.user.id;
    tournamentService.joinTournament(userId, id, (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (result && result.error) return res.status(result.status).json({ error: result.error });
        res.status(201).json(result.data || { message: 'Registered' });
    });
}

async function handleLeave(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid tournament id' });
    const userId = req.user.id;
    tournamentService.leaveTournament(userId, id, (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (result && result.error) return res.status(result.status).json({ error: result.error });
        res.status(200).json(result.data || { message: 'Left tournament' });
    });
}

module.exports = {
    handleList,
    handleGet,
    handleJoin,
    handleLeave
};
