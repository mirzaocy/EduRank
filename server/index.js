const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const router = require('./routes');
const db = require('./config');
const { initSockets } = require('./sockets/matchmakingSocket');
const { resolveServerConfig } = require('./config/serverConfig');
const { authenticateToken, requireAdmin } = require('./middlewares/authMiddleware');
const { normalizeSubject, validateMatchPayload } = require('./services/matchService');

const app = express();
const server = http.createServer(app);
const clientRoot = path.join(__dirname, '..', 'client');
app.disable('x-powered-by');
// Only trust proxy-provided client IPs when an explicitly configured reverse
// proxy sits in front of this service (Railway, Nginx, Cloudflare, etc.).
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

const allowedOrigins = String(process.env.CLIENT_ORIGIN || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const corsOrigin = allowedOrigins.length > 0
    ? allowedOrigins
    : (process.env.NODE_ENV === 'production' ? false : true);

const io = new Server(server, {
    cors: {
        origin: corsOrigin,
        methods: ["GET", "POST"]
    }
});

app.use(cors({
    origin: corsOrigin,
    credentials: true
}));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
        const isSecure = req.secure || req.get('x-forwarded-proto') === 'https';
        if (isSecure) {
            res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
        }
    }
    next();
});
app.use(express.json({ limit: '2mb' }));
// Only publish browser assets. Serving the project root exposes server source,
// dependency metadata, and other implementation files to every visitor.
app.use(express.static(clientRoot));
// Expose page HTML at root-level filenames so homepage links like
// `/leaderboard.html` and `/feedback.html` work without requiring `/pages/`.
app.use(express.static(path.join(clientRoot, 'pages')));
// Keep existing /client/* links working while the public root is the client app.
app.use('/client', express.static(clientRoot));
// The static pages use their historic flat asset names (for example,
// `/css/style.css` and `interaksi.js`). Keep those URLs working while the files
// remain organized by asset type.
app.use('/pages', express.static(path.join(clientRoot, 'pages')));
app.use('/pages', express.static(path.join(clientRoot, 'css')));
app.use('/pages', express.static(path.join(clientRoot, 'js', 'components')));
app.use('/pages', express.static(path.join(clientRoot, 'js', 'config')));
app.use('/pages', express.static(path.join(clientRoot, 'js', 'pages')));

const uploadsRoot = path.join(__dirname, '../uploads');
app.get('/uploads/:filename', requireAdmin, (req, res, next) => {
    const requestedName = String(req.params.filename || '');
    if (!requestedName || requestedName !== path.basename(requestedName)) {
        return res.status(400).json({ error: 'Invalid file request.' });
    }

    const filePath = path.join(uploadsRoot, requestedName);
    if (!filePath.startsWith(uploadsRoot + path.sep) && filePath !== uploadsRoot) {
        return res.status(400).json({ error: 'Invalid file request.' });
    }

    res.sendFile(filePath, (err) => {
        if (err) {
            if (err.code === 'ENOENT') return res.status(404).json({ error: 'Not found.' });
            next(err);
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(clientRoot, 'pages', 'index.html'));
});

// Mount routes
app.use(router);

app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON request body.' });
    }
    if (err && err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body is too large.' });
    }
    console.error('Unhandled request error:', err);
    res.status(500).json({ error: 'Internal server error.' });
});

// Mount socket handlers
initSockets(io);

function startServer(options = {}) {
    const config = resolveServerConfig(options);
    const port = config.port;
    const host = config.host;

    return server.listen(port, host, () => {
        console.log(`Server is running on ${host}:${port}`);
        console.log(`[ANTI-CHEAT] System active: Speed detection, Rate limiting, Session dedup, Input validation`);
    });
}

function shutdown(signal) {
    console.log(`Received ${signal}; shutting down gracefully.`);
    io.close();
    server.close((err) => {
        db.close();
        if (err) {
            console.error('Error while closing server:', err);
            process.exitCode = 1;
        }
        process.exit();
    });
    setTimeout(() => process.exit(1), 10_000).unref();
}

if (require.main === module) {
    startServer(process.env);
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
}

module.exports = {
    app,
    server,
    startServer,
    resolveServerConfig,
    normalizeSubject,
    validateMatchPayload
};
