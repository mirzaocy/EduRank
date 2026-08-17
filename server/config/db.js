const mysql = require('mysql2');
const path = require('path');

// Load environment variables from the server folder first, then fall back to the project root.
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function parsePort(value, fallback) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function parseMysqlUrl(rawUrl) {
    if (!rawUrl) return {};
    try {
        const url = new URL(rawUrl);
        return {
            host: url.hostname,
            user: decodeURIComponent(url.username || ''),
            password: decodeURIComponent(url.password || ''),
            database: url.pathname ? decodeURIComponent(url.pathname.replace(/^\//, '')) : '',
            port: url.port ? parsePort(url.port, 3306) : 3306
        };
    } catch (error) {
        return {};
    }
}

const directConfig = {
    host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.RAILWAY_MYSQL_HOST,
    user: process.env.DB_USER || process.env.MYSQLUSER || process.env.RAILWAY_MYSQL_USER,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.RAILWAY_MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.RAILWAY_MYSQL_DATABASE,
    port: process.env.DB_PORT || process.env.MYSQLPORT || process.env.RAILWAY_MYSQL_PORT
};

const urlConfig = parseMysqlUrl(process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQLURL);

const resolvedHost = directConfig.host || urlConfig.host;
const resolvedUser = directConfig.user || urlConfig.user;
const resolvedPassword = directConfig.password || urlConfig.password;
const resolvedDatabase = directConfig.database || urlConfig.database;
const resolvedPort = directConfig.port || urlConfig.port;

if (process.env.NODE_ENV === 'production' && (!resolvedHost || !resolvedUser || !resolvedDatabase)) {
    throw new Error('MySQL environment variables are required in production. Set DB_* , MYSQL* , or DATABASE_URL / MYSQL_URL from Railway.');
}

const pool = mysql.createPool({
    host: resolvedHost || 'localhost',
    user: resolvedUser || 'root',
    password: resolvedPassword || '',
    database: resolvedDatabase || 'railway',
    port: parsePort(resolvedPort, 3306),
    multipleStatements: false,
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 100,
    connectTimeout: 10_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

const simpleDb = require('../simple-db');

const forceSimpleDb = Boolean(process.env.EDURANK_DB_PATH);
let mysqlConnected = false;

function useSimpleDb() {
    return forceSimpleDb || (!mysqlConnected && process.env.NODE_ENV !== 'production');
}

if (process.env.NODE_ENV !== 'production') {
    console.log('[DB] Resolved DB config:', {
        host: resolvedHost,
        user: resolvedUser,
        database: resolvedDatabase,
        port: resolvedPort,
        env: process.env.NODE_ENV,
        edurankDbPath: process.env.EDURANK_DB_PATH || '(none)',
        forceSimpleDb
    });
}

// Test connection on startup
if (!forceSimpleDb) {
    pool.getConnection((err, connection) => {
        if (err) {
            mysqlConnected = false;
            console.error('\n================================================================');
            console.error('[MYSQL-ERROR] Gagal terhubung ke database MySQL! Menggunakan fallback database.');
            console.error(`Pesan Error: ${err.message}`);
            console.error('================================================================\n');
            return;
        }
        mysqlConnected = true;
        console.log('[MYSQL] Koneksi ke MySQL berhasil dibangun.');
        connection.release();
        // In development the initial schema check may have selected the local
        // fallback before this asynchronous connection succeeded.
        if (process.env.NODE_ENV !== 'production') initDb();
    });
} else {
    console.log('[DB] EDURANK_DB_PATH is set; forcing simple JSON database fallback.');
}

// Auto-initialize tables
function initDb() {
    if (useSimpleDb()) return;
    const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            rank_points INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            nama VARCHAR(100) DEFAULT NULL,
            tanggal_lahir DATE DEFAULT NULL,
            foto VARCHAR(255) DEFAULT NULL,
            role VARCHAR(20) DEFAULT 'siswa',
            last_login TIMESTAMP NULL DEFAULT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            bio VARCHAR(255) DEFAULT NULL,
            status VARCHAR(50) DEFAULT 'Offline',
            avatar LONGTEXT DEFAULT NULL,
            exp INT DEFAULT 0,
            elo_matematika INT DEFAULT 0,
            elo_fisika INT DEFAULT 0,
            elo_informatika INT DEFAULT 0,
            elo_bahasainggris INT DEFAULT 0,
            highest_matematika INT DEFAULT 0,
            highest_fisika INT DEFAULT 0,
            highest_informatika INT DEFAULT 0,
            highest_bahasainggris INT DEFAULT 0,
            matches INT DEFAULT 0,
            wins INT DEFAULT 0,
            country VARCHAR(100) DEFAULT NULL,
            city VARCHAR(100) DEFAULT NULL,
            province VARCHAR(100) DEFAULT NULL,
            class_level VARCHAR(50) DEFAULT NULL,
            school VARCHAR(100) DEFAULT NULL,
            banned TINYINT(1) DEFAULT 0,
            student_photo VARCHAR(255) DEFAULT NULL,
            student_card_photo VARCHAR(255) DEFAULT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createFeedbackTable = `
        CREATE TABLE IF NOT EXISTS feedback (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            created_at VARCHAR(255)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createMatchHistoryTable = `
        CREATE TABLE IF NOT EXISTS match_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            opponent_name VARCHAR(255) NOT NULL,
            subject VARCHAR(100) NOT NULL,
            mode VARCHAR(50) NOT NULL,
            is_win TINYINT NOT NULL,
            elo_change INT DEFAULT 0,
            duration_seconds INT DEFAULT 0,
            details LONGTEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_match_history_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createFriendsTable = `
        CREATE TABLE IF NOT EXISTS friends (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            friend_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY user_friend_unique (user_id, friend_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    pool.query(createUsersTable, (err) => {
        if (err) {
            console.error('[MYSQL-ERROR] Gagal membuat/memverifikasi tabel users:', err.message);
        } else {
            console.log('[MYSQL] Tabel "users" terverifikasi/dibuat.');
        }
    });

    pool.query(createFeedbackTable, (err) => {
        if (err) {
            console.error('[MYSQL-ERROR] Gagal membuat/memverifikasi tabel feedback:', err.message);
        } else {
            console.log('[MYSQL] Tabel "feedback" terverifikasi/dibuat.');
        }
    });

    pool.query(createMatchHistoryTable, (err) => {
        if (err) {
            console.error('[MYSQL-ERROR] Gagal membuat/memverifikasi tabel match_history:', err.message);
        } else {
            console.log('[MYSQL] Tabel "match_history" terverifikasi/dibuat.');
        }
    });
    pool.query(`SHOW COLUMNS FROM match_history LIKE 'duration_seconds'`, (showErr, rows) => {
        if (showErr) return;
        if (!rows || rows.length === 0) {
            pool.query(`ALTER TABLE match_history ADD COLUMN duration_seconds INT DEFAULT 0`, (alterErr) => {
                if (alterErr) {
                    console.error('[MYSQL-ERROR] Gagal menambah kolom match_history.duration_seconds:', alterErr.message);
                } else {
                    console.log('[MYSQL] Kolom match_history.duration_seconds ditambahkan.');
                }
            });
        }
    });
    // Ensure details column exists for storing per-question details as JSON (backwards compatible)
    pool.query(`SHOW COLUMNS FROM match_history LIKE 'details'`, (showErr2, rows2) => {
        if (showErr2) return;
        if (!rows2 || rows2.length === 0) {
            pool.query(`ALTER TABLE match_history ADD COLUMN details LONGTEXT DEFAULT NULL`, (alterErr) => {
                if (alterErr) {
                    console.error('[MYSQL-ERROR] Gagal menambah kolom match_history.details:', alterErr.message);
                } else {
                    console.log('[MYSQL] Kolom match_history.details ditambahkan.');
                }
            });
        }
    });

    pool.query(createFriendsTable, (err) => {
        if (err) {
            console.error('[MYSQL-ERROR] Gagal membuat/memverifikasi tabel friends:', err.message);
        } else {
            console.log('[MYSQL] Tabel "friends" terverifikasi/dibuat.');
        }
    });

    const createAchievementsTable = `
        CREATE TABLE IF NOT EXISTS achievements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            key_name VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            description TEXT DEFAULT NULL,
            icon VARCHAR(255) DEFAULT NULL,
            category VARCHAR(100) DEFAULT NULL,
            requirement_type VARCHAR(100) DEFAULT NULL,
            requirement_value INT DEFAULT 0,
            reward_exp INT DEFAULT 0,
            is_active TINYINT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createUserAchievementsTable = `
        CREATE TABLE IF NOT EXISTS user_achievements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            achievement_id INT NOT NULL,
            progress INT DEFAULT 0,
            unlocked_at TIMESTAMP NULL DEFAULT NULL,
            UNIQUE KEY uq_user_achievement (user_id, achievement_id),
            INDEX idx_user_achievements_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    pool.query(createAchievementsTable, (err) => {
        if (err) console.error('[MYSQL-ERROR] Gagal membuat/memverifikasi tabel achievements:', err.message);
        else console.log('[MYSQL] Tabel "achievements" terverifikasi/dibuat.');
    });

    pool.query(createUserAchievementsTable, (err) => {
        if (err) console.error('[MYSQL-ERROR] Gagal membuat/memverifikasi tabel user_achievements:', err.message);
        else console.log('[MYSQL] Tabel "user_achievements" terverifikasi/dibuat.');
    });

    const createNotificationsTable = `
        CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            recipient_id INT NOT NULL,
            type VARCHAR(100) NOT NULL,
            title VARCHAR(255) DEFAULT NULL,
            message TEXT DEFAULT NULL,
            actor_id INT DEFAULT NULL,
            entity_type VARCHAR(100) DEFAULT NULL,
            entity_id INT DEFAULT NULL,
            payload JSON DEFAULT NULL,
            is_read TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notifications_recipient (recipient_id),
            INDEX idx_notifications_read (recipient_id, is_read)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createActivityTable = `
        CREATE TABLE IF NOT EXISTS activity (
            id INT AUTO_INCREMENT PRIMARY KEY,
            actor_id INT NOT NULL,
            verb VARCHAR(100) NOT NULL,
            object_type VARCHAR(100) DEFAULT NULL,
            object_id INT DEFAULT NULL,
            metadata JSON DEFAULT NULL,
            visibility VARCHAR(50) DEFAULT 'friends',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_activity_created (created_at),
            INDEX idx_activity_actor (actor_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createTournamentsTable = `
        CREATE TABLE IF NOT EXISTS tournaments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            key_name VARCHAR(100) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            subject VARCHAR(100) DEFAULT 'all',
            description TEXT DEFAULT NULL,
            format VARCHAR(50) DEFAULT 'single_elimination',
            max_participants INT DEFAULT 16,
            slots_taken INT DEFAULT 0,
            registration_open_at TIMESTAMP NULL DEFAULT NULL,
            registration_close_at TIMESTAMP NULL DEFAULT NULL,
            start_at TIMESTAMP NULL DEFAULT NULL,
            status VARCHAR(50) DEFAULT 'draft',
            seed BIGINT DEFAULT NULL,
            bracket_snapshot JSON DEFAULT NULL,
            reward_json JSON DEFAULT NULL,
            rules_json JSON DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_tournaments_status (status),
            INDEX idx_tournaments_start_at (start_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createTournamentParticipantsTable = `
        CREATE TABLE IF NOT EXISTS tournament_participants (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tournament_id INT NOT NULL,
            user_id INT NOT NULL,
            registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_tournament_user (tournament_id, user_id),
            INDEX idx_tp_tournament (tournament_id),
            INDEX idx_tp_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createTournamentMatchesTable = `
        CREATE TABLE IF NOT EXISTS tournament_matches (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tournament_id INT NOT NULL,
            round INT NOT NULL,
            match_index INT NOT NULL,
            player_a_id INT DEFAULT NULL,
            player_b_id INT DEFAULT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            battle_id INT DEFAULT NULL,
            winner_id INT DEFAULT NULL,
            scheduled_at TIMESTAMP NULL DEFAULT NULL,
            started_at TIMESTAMP NULL DEFAULT NULL,
            finished_at TIMESTAMP NULL DEFAULT NULL,
            UNIQUE KEY uq_tournament_match (tournament_id, round, match_index),
            INDEX idx_tm_tournament (tournament_id),
            INDEX idx_tm_player_a (player_a_id),
            INDEX idx_tm_player_b (player_b_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    const createTournamentRewardLog = `
        CREATE TABLE IF NOT EXISTS tournament_reward_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tournament_id INT NOT NULL,
            user_id INT NOT NULL,
            reward_type VARCHAR(100) NOT NULL,
            payload JSON DEFAULT NULL,
            awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_tournament_reward (tournament_id, user_id, reward_type),
            INDEX idx_trl_tournament (tournament_id),
            INDEX idx_trl_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    pool.query(createNotificationsTable, (err) => {
        if (err) console.error('[MYSQL-ERROR] Gagal membuat/memverifikasi tabel notifications:', err.message);
        else console.log('[MYSQL] Tabel "notifications" terverifikasi/dibuat.');
    });

    pool.query(createActivityTable, (err) => {
        if (err) console.error('[MYSQL-ERROR] Gagal membuat/memverifikasi tabel activity:', err.message);
        else console.log('[MYSQL] Tabel "activity" terverifikasi/dibuat.');
    });

    pool.query(createTournamentsTable, (err) => {
        if (err) console.error('[MYSQL-ERROR] Gagal membuat/memverifikasi tabel tournaments:', err.message);
        else console.log('[MYSQL] Tabel "tournaments" terverifikasi/dibuat.');
    });

    pool.query(createTournamentParticipantsTable, (err) => {
        if (err) console.error('[MYSQL-ERROR] Gagal membuat/memverifikasi tabel tournament_participants:', err.message);
        else console.log('[MYSQL] Tabel "tournament_participants" terverifikasi/dibuat.');
    });

    pool.query(createTournamentMatchesTable, (err) => {
        if (err) console.error('[MYSQL-ERROR] Gagal membuat/memverifikasi tabel tournament_matches:', err.message);
        else console.log('[MYSQL] Tabel "tournament_matches" terverifikasi/dibuat.');
    });

    pool.query(createTournamentRewardLog, (err) => {
        if (err) console.error('[MYSQL-ERROR] Gagal membuat/memverifikasi tabel tournament_reward_log:', err.message);
        else console.log('[MYSQL] Tabel "tournament_reward_log" terverifikasi/dibuat.');
    });

    // Lightweight migrations for older databases that may miss new columns.
    const usersColumns = [
        ['username', "ALTER TABLE users ADD COLUMN username VARCHAR(255) DEFAULT '-'"],
        ['bio', "ALTER TABLE users ADD COLUMN bio TEXT"],
        ['country', "ALTER TABLE users ADD COLUMN country VARCHAR(255) DEFAULT 'Indonesia'"],
        ['province', "ALTER TABLE users ADD COLUMN province VARCHAR(255) DEFAULT '-'"],
        ['city', "ALTER TABLE users ADD COLUMN city VARCHAR(255) DEFAULT '-'"],
        ['class_level', "ALTER TABLE users ADD COLUMN class_level VARCHAR(255) DEFAULT '-'"],
        ['school', "ALTER TABLE users ADD COLUMN school VARCHAR(255) DEFAULT '-'"],
        ['avatar', "ALTER TABLE users ADD COLUMN avatar LONGTEXT"],
        ['exp', "ALTER TABLE users ADD COLUMN exp INT DEFAULT 0"],
        ['matches', "ALTER TABLE users ADD COLUMN matches INT DEFAULT 0"],
        ['wins', "ALTER TABLE users ADD COLUMN wins INT DEFAULT 0"],
        ['elo_matematika', "ALTER TABLE users ADD COLUMN elo_matematika INT DEFAULT 420"],
        ['elo_fisika', "ALTER TABLE users ADD COLUMN elo_fisika INT DEFAULT 228"],
        ['elo_bahasainggris', "ALTER TABLE users ADD COLUMN elo_bahasainggris INT DEFAULT 170"],
        ['elo_informatika', "ALTER TABLE users ADD COLUMN elo_informatika INT DEFAULT 760"],
        ['highest_matematika', "ALTER TABLE users ADD COLUMN highest_matematika VARCHAR(255) DEFAULT 'Bronze III'"],
        ['highest_fisika', "ALTER TABLE users ADD COLUMN highest_fisika VARCHAR(255) DEFAULT 'Bronze I'"],
        ['highest_bahasainggris', "ALTER TABLE users ADD COLUMN highest_bahasainggris VARCHAR(255) DEFAULT 'Bronze I'"],
        ['highest_informatika', "ALTER TABLE users ADD COLUMN highest_informatika VARCHAR(255) DEFAULT 'Epic IV'"],
        ['birth_date', "ALTER TABLE users ADD COLUMN birth_date VARCHAR(255) DEFAULT '-'"],
        ['student_photo', "ALTER TABLE users ADD COLUMN student_photo VARCHAR(255) DEFAULT '-'"],
        ['student_card_photo', "ALTER TABLE users ADD COLUMN student_card_photo VARCHAR(255) DEFAULT '-'"],
        ['banned', "ALTER TABLE users ADD COLUMN banned TINYINT DEFAULT 0"]
    ];

    usersColumns.forEach(([columnName, alterSql]) => {
        pool.query(`SHOW COLUMNS FROM users LIKE ?`, [columnName], (showErr, rows) => {
            if (showErr) {
                console.error(`[MYSQL-ERROR] Gagal memeriksa kolom users.${columnName}:`, showErr.message);
                return;
            }
            if (!rows || rows.length === 0) {
                pool.query(alterSql, (alterErr) => {
                    if (alterErr) {
                        console.error(`[MYSQL-ERROR] Gagal menambah kolom users.${columnName}:`, alterErr.message);
                    } else {
                        console.log(`[MYSQL] Kolom users.${columnName} ditambahkan.`);
                    }
                });
            }
        });
    });

    // Avatar uploads are stored as data URLs. Older deployments created this
    // column as VARCHAR(255), which truncates even small images.
    pool.query("SHOW COLUMNS FROM users LIKE 'avatar'", (showErr, rows) => {
        const avatarColumn = rows && rows[0];
        if (showErr || !avatarColumn || /longtext/i.test(String(avatarColumn.Type))) return;
        pool.query('ALTER TABLE users MODIFY COLUMN avatar LONGTEXT DEFAULT NULL', (alterErr) => {
            if (alterErr) {
                console.error('[MYSQL-ERROR] Gagal memperbarui kolom users.avatar:', alterErr.message);
            } else {
                console.log('[MYSQL] Kolom users.avatar diperbarui ke LONGTEXT.');
            }
        });
    });
}

// Start table verification
initDb();

function run(query, params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = [];
    }

    if (useSimpleDb()) {
        return simpleDb.run(query, params, callback);
    }

    pool.query(query, params, (err, results) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        const context = {
            lastID: results ? results.insertId : null,
            changes: results ? results.affectedRows : null
        };

        if (callback) {
            callback.call(context, null, results);
        }
    });
}

function get(query, params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = [];
    }

    if (useSimpleDb()) {
        return simpleDb.get(query, params, callback);
    }

    pool.query(query, params, (err, results) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        const row = results && results.length > 0 ? results[0] : null;
        if (callback) callback(null, row);
    });
}

function all(query, params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = [];
    }

    if (useSimpleDb()) {
        return simpleDb.all(query, params, callback);
    }

    pool.query(query, params, (err, results) => {
        if (err) {
            if (callback) callback(err);
            return;
        }

        if (callback) callback(null, results);
    });
}

function addFeedback(feedback) {
    if (useSimpleDb()) {
        return simpleDb.addFeedback(feedback);
    }

    const query = 'INSERT INTO feedback (name, email, message, created_at) VALUES (?, ?, ?, ?)';
    const params = [feedback.name, feedback.email, feedback.message, feedback.created_at];
    pool.query(query, params, (err) => {
        if (err) {
            console.error('[MYSQL-ERROR] Gagal menyimpan feedback ke MySQL:', err.message);
        }
    });
}

function ping(callback) {
    if (useSimpleDb()) {
        return simpleDb.ping(callback);
    }

    pool.query('SELECT 1 AS ok', (err, rows) => {
        if (callback) callback(err, rows && rows[0] ? rows[0] : null);
    });
}

module.exports = {
    run,
    get,
    all,
    addFeedback,
    ping,
    serialize: (fn) => fn(),
    close: () => {
        if (pool && typeof pool.end === 'function') pool.end();
    }
};
