const db = require('../config');

function listTournaments(options = {}, callback) {
    const where = [];
    const params = [];
    if (options.status) {
        where.push('status = ?');
        params.push(options.status);
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `SELECT id, key_name, name, subject, format, max_participants, slots_taken, start_at, status, reward_json FROM tournaments ${whereClause} ORDER BY start_at DESC LIMIT 100`;
    db.all(sql, params, callback);
}

function getTournament(tournamentId, callback) {
    db.get(`SELECT id, key_name, name, subject, description, format, max_participants, slots_taken, registration_open_at, registration_close_at, start_at, status, seed, bracket_snapshot, reward_json, rules_json FROM tournaments WHERE id = ? LIMIT 1`, [tournamentId], (err, row) => {
        if (err) return callback(err);
        if (!row) return callback(null, null);
        // fetch participants summary
        db.all(`SELECT u.id, u.nama AS name, u.avatar, u.exp FROM tournament_participants tp JOIN users u ON u.id = tp.user_id WHERE tp.tournament_id = ? ORDER BY tp.registered_at ASC LIMIT 200`, [tournamentId], (pErr, rows) => {
            if (pErr) return callback(pErr);
            row.participants = rows || [];
            callback(null, row);
        });
    });
}

function joinTournament(userId, tournamentId, callback) {
    // Validate tournament status first
    db.get(`SELECT id, status, registration_open_at, registration_close_at, start_at, max_participants FROM tournaments WHERE id = ? LIMIT 1`, [tournamentId], (err, t) => {
        if (err) return callback(err);
        if (!t) return callback(null, { status: 404, error: 'Tournament not found' });
        if (t.status !== 'registration' && t.status !== 'upcoming') return callback(null, { status: 400, error: 'Registration closed' });

        // Attempt to reserve slot atomically by incrementing slots_taken only if available
        db.run(`UPDATE tournaments SET slots_taken = slots_taken + 1 WHERE id = ? AND slots_taken < max_participants`, [tournamentId], function (updErr) {
            if (updErr) return callback(updErr);
            if (!this || !this.changes) {
                return callback(null, { status: 409, error: 'Tournament is full' });
            }

            // Now insert participant; if duplicate, rollback slot increment
            db.run(`INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?, ?)`, [tournamentId, userId], function (insErr) {
                if (insErr) {
                    // rollback
                    db.run(`UPDATE tournaments SET slots_taken = GREATEST(0, slots_taken - 1) WHERE id = ?`, [tournamentId], () => {});
                    if (insErr && insErr.code === 'ER_DUP_ENTRY') {
                        return callback(null, { status: 409, error: 'Already registered' });
                    }
                    return callback(insErr);
                }
                return callback(null, { status: 201, data: { message: 'Registered' } });
            });
        });
    });
}

function leaveTournament(userId, tournamentId, callback) {
    db.run(`DELETE FROM tournament_participants WHERE tournament_id = ? AND user_id = ?`, [tournamentId, userId], function (err) {
        if (err) return callback(err);
        if (!this || !this.changes) return callback(null, { status: 404, error: 'Not registered' });
        // decrement slot
        db.run(`UPDATE tournaments SET slots_taken = GREATEST(0, slots_taken - 1) WHERE id = ?`, [tournamentId], function (updErr) {
            if (updErr) return callback(updErr);
            return callback(null, { status: 200, data: { message: 'Left tournament' } });
        });
    });
}

module.exports = {
    listTournaments,
    getTournament,
    joinTournament,
    leaveTournament
};
