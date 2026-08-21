const jwt = require('jsonwebtoken');
const db = require('../config');
const { getJwtSecret } = require('../config/serverConfig');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const [scheme, token] = typeof authHeader === 'string' ? authHeader.trim().split(/\s+/) : [];
    if (scheme !== 'Bearer' || !token) return res.sendStatus(401);

    const secret = getJwtSecret();
    jwt.verify(token, secret, { algorithms: ['HS256'] }, (err, user) => {
        if (err) return res.sendStatus(403);
        
        db.get(`SELECT banned, role FROM users WHERE id = ?`, [user.id], (dbErr, dbUser) => {
            if (dbErr || !dbUser) {
                return res.sendStatus(403);
            }
            if (dbUser.banned) {
                return res.status(403).json({ error: "Akun anda telah diban" });
            }
            req.user = { ...user, role: dbUser.role };
            next();
        });
    });
};

const requireAdmin = (req, res, next) => {
    authenticateToken(req, res, () => {
        if (req.user.role === 'admin' || req.user.role === 'developer') {
            return next();
        }

        const adminIds = String(process.env.ADMIN_USER_IDS || '')
            .split(',')
            .map((id) => Number(id.trim()))
            .filter(Number.isInteger);
        if (adminIds.includes(Number(req.user.id))) {
            return next();
        }

        return res.sendStatus(403);
    });
};

const requireDeveloper = (req, res, next) => {
    authenticateToken(req, res, () => {
        if (req.user.role === 'developer') return next();
        return res.sendStatus(403);
    });
};

module.exports = {
    authenticateToken,
    requireAdmin,
    requireDeveloper
};
