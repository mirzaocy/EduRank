const fs = require('fs');
const path = require('path');

function getDbPath() {
  return process.env.EDURANK_DB_PATH || path.resolve(__dirname, 'edurank.json');
}

function ensureDb() {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    const parentDir = path.dirname(dbPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify({ users: [], matchHistory: [], feedback: [], friends: [] }, null, 2));
  }
}

function readDb() {
  ensureDb();
  try {
    const content = fs.readFileSync(getDbPath(), 'utf8');
    const parsed = JSON.parse(content);
    if (!parsed.users) parsed.users = [];
    if (!parsed.matchHistory) parsed.matchHistory = [];
    if (!parsed.feedback) parsed.feedback = [];
    if (!parsed.friends) parsed.friends = [];
    return parsed;
  } catch (err) {
    return { users: [], matchHistory: [], feedback: [] };
  }
}

function writeDb(data) {
  ensureDb();
  fs.writeFileSync(getDbPath(), JSON.stringify(data, null, 2));
}

function getUserByEmail(email) {
  const data = readDb();
  return data.users.find((user) => user && user.email && user.email.toLowerCase() === String(email).toLowerCase()) || null;
}

function getUserById(id) {
  const data = readDb();
  return data.users.find((user) => user && user.id === Number(id)) || null;
}

function createUser(user) {
  const data = readDb();
  const nextId = data.users.length ? Math.max(...data.users.map((u) => u.id || 0)) + 1 : 1;
  const newUser = { id: nextId, ...user };
  data.users.push(newUser);
  writeDb(data);
  return newUser;
}

function updateUser(id, updates) {
  const data = readDb();
  const index = data.users.findIndex((user) => user && user.id === Number(id));
  if (index === -1) return null;
  data.users[index] = { ...data.users[index], ...updates };
  writeDb(data);
  return data.users[index];
}

function listUsers() {
  return readDb().users;
}

function updatePlayerStats(userId, subject, isWin, newElo, score) {
  const data = readDb();
  const index = data.users.findIndex((user) => user && user.id === Number(userId));
  if (index === -1) return null;
  const user = data.users[index];
  const expGained = 20 + (isWin === true ? 30 : 0);
  const winAdd = isWin === true ? 1 : 0;
  user.exp = (user.exp || 0) + expGained;
  user.matches = (user.matches || 0) + 1;
  user.wins = (user.wins || 0) + winAdd;
  user[`elo_${subject}`] = newElo;
  data.users[index] = user;
  writeDb(data);
  return user;
}

function addFeedback(feedback) {
  const data = readDb();
  if (!data.feedback) data.feedback = [];
  const id = data.feedback.length + 1;
  const item = { id, ...feedback };
  data.feedback.push(item);
  writeDb(data);
  return item;
}

function ping(callback) {
  if (callback) callback(null, { ok: 1 });
}

function run(query, params = [], callback) {
  if (typeof params === 'function') {
    callback = params;
    params = [];
  }
  if (!Array.isArray(params)) {
    params = [params];
  }
  const sql = String(query).trim();
  const data = readDb();
  let lastID = null;
  let changes = 0;

  if (sql.startsWith('INSERT INTO users')) {
    const nextId = data.users.length ? Math.max(...data.users.map((u) => u.id || 0)) + 1 : 1;
    const usesUserModelSchema = sql.includes('tanggal_lahir');
    const newUser = usesUserModelSchema
      ? {
          id: nextId,
          username: params[0] || '',
          email: params[1] || '',
          password: params[2] || '',
          name: params[3] || '',
          nama: params[3] || '',
          tanggal_lahir: params[4] || null,
          foto: params[5] || null,
          role: params[6] || 'siswa',
          bio: params[7] || null,
          avatar: params[8] || null,
          student_photo: params[9] || null,
          student_card_photo: params[10] || null,
          status: params[11] || 'Offline',
          exp: 0,
          matches: 0,
          wins: 0,
          elo_matematika: 420,
          elo_fisika: 420,
          elo_bahasainggris: 420,
          elo_informatika: 420
        }
      : {
          id: nextId,
          name: params[0] || '',
          username: params[1] || params[0] || '',
          email: params[2] || '',
          password: params[3] || '',
          exp: 0,
          matches: 0,
          wins: 0,
          elo_matematika: 420,
          elo_fisika: 420,
          elo_bahasainggris: 420,
          elo_informatika: 420
        };
    data.users.push(newUser);
    writeDb(data);
    lastID = nextId;
    changes = 1;
  } else if (sql.startsWith('UPDATE users SET')) {
    const id = params[params.length - 1];
    const index = data.users.findIndex((u) => u && u.id === Number(id));
    if (index !== -1) {
      if (sql.includes('foto = COALESCE')) {
        data.users[index] = {
          ...data.users[index],
          name: params[0],
          nama: params[0],
          bio: params[1],
          avatar: params[2] || data.users[index].avatar,
          foto: params[3] || data.users[index].foto
        };
      } else if (sql.includes('username = ?') && sql.includes('province = ?')) {
        data.users[index] = {
          ...data.users[index],
          username: params[0],
          province: params[1],
          city: params[2],
          school: params[3],
          class_level: params[4]
        };
      } else if (sql.includes('nama = ?') || sql.includes('name = ?')) {
        data.users[index] = {
          ...data.users[index],
          name: params[0],
          nama: params[0],
          username: params[1] || data.users[index].username,
          bio: params[2] || data.users[index].bio,
          country: params[3] || data.users[index].country,
          class_level: params[4] || data.users[index].class_level,
          school: params[5] || data.users[index].school,
          avatar: params[6] || data.users[index].avatar
        };
      } else if (sql.includes('exp = exp + ?')) {
        const u = data.users[index];
        u.exp = (u.exp || 0) + (params[0] || 0);
        u.matches = (u.matches || 0) + 1;
        u.wins = (u.wins || 0) + (params[1] || 0);
        const eloColumn = sql.match(/elo_(matematika|fisika|bahasainggris|informatika)\s*=\s*\?/i);
        if (eloColumn && params[2] !== undefined) {
          u[`elo_${eloColumn[1]}`] = params[2];
        }
      }
      writeDb(data);
      changes = 1;
    }
  } else if (sql.startsWith('INSERT INTO match_history')) {
    if (!data.matchHistory) data.matchHistory = [];
    const [userId, opponentName, subject, mode, isWin, eloChange, durationSeconds, createdAt, details] = params;
    let parsedDetails = null;
    if (details) {
      try { parsedDetails = JSON.parse(details); } catch (e) { parsedDetails = details; }
    }
    data.matchHistory.push({
      id: data.matchHistory.length ? Math.max(...data.matchHistory.map((row) => row.id || 0)) + 1 : 1,
      user_id: Number(userId),
      opponent_name: String(opponentName || ''),
      subject: String(subject || ''),
      mode: String(mode || ''),
      is_win: Number(isWin) || 0,
      elo_change: Number(eloChange) || 0,
      duration_seconds: Number(durationSeconds) || 0,
      details: parsedDetails,
      created_at: String(createdAt || new Date().toISOString())
    });
    writeDb(data);
    changes = 1;
  } else if (sql.startsWith('INSERT INTO friends')) {
    if (!data.friends) data.friends = [];
    const [userId, friendId] = params;
    const exists = data.friends.some((row) => row.user_id === Number(userId) && row.friend_id === Number(friendId));
    if (!exists) {
      data.friends.push({
        id: data.friends.length ? Math.max(...data.friends.map((row) => row.id || 0)) + 1 : 1,
        user_id: Number(userId),
        friend_id: Number(friendId),
        created_at: new Date().toISOString()
      });
      writeDb(data);
      changes = 1;
    }
  } else if (sql.startsWith('DELETE FROM friends')) {
    const [userId, friendId, reverseId, reverseUserId] = params;
    if (!data.friends) data.friends = [];
    const initialLength = data.friends.length;
    data.friends = data.friends.filter((row) => {
      if (sql.includes('OR')) {
        return !(row.user_id === Number(userId) && row.friend_id === Number(friendId)) && !(row.user_id === Number(reverseId) && row.friend_id === Number(reverseUserId));
      }
      return !(row.user_id === Number(userId) && row.friend_id === Number(friendId));
    });
    if (data.friends.length !== initialLength) {
      writeDb(data);
      changes = initialLength - data.friends.length;
    }
  }

  const ctx = { lastID, changes };
  if (callback) callback.call(ctx, null, { lastID, insertId: lastID, changes, affectedRows: changes });
  return ctx;
}

function get(query, params = [], callback) {
  if (typeof params === 'function') {
    callback = params;
    params = [];
  }
  if (!Array.isArray(params)) {
    params = [params];
  }
  const data = readDb();
  const targetVal = params[0];
  const user = data.users.find(
    (u) => u && (u.id === Number(targetVal) || u.email === String(targetVal) || u.username === String(targetVal))
  ) || null;
  if (callback) callback(null, user);
  return user;
}

function all(query, params = [], callback) {
  if (typeof params === 'function') {
    callback = params;
    params = [];
  }
  if (!Array.isArray(params)) {
    params = [params];
  }
  const data = readDb();

  let rows = [];
  const normalized = sqlNormalize(query);

  if (normalized.startsWith('select') && normalized.includes('from friends')) {
    rows = (data.friends || []).filter((friend) => friend.user_id === Number(params[0]));
    rows = rows.map((friend) => {
      const user = (data.users || []).find((u) => u.id === Number(friend.friend_id));
      return {
        id: friend.id,
        user_id: friend.user_id,
        friend_id: friend.friend_id,
        created_at: friend.created_at,
        friend_user_id: user ? user.id : null,
        username: user ? user.username : null,
        name: user ? user.name || user.nama : null,
        avatar: user ? user.avatar : null,
        country: user ? user.country : null,
        city: user ? user.city : null,
        school: user ? user.school : null,
        class_level: user ? user.class_level : null,
        exp: user ? user.exp : null,
        matches: user ? user.matches : null,
        wins: user ? user.wins : null,
        total_elo: user ? ((Number(user.elo_matematika)||0) + (Number(user.elo_fisika)||0) + (Number(user.elo_bahasainggris)||0) + (Number(user.elo_informatika)||0)) : null
      };
    });
  } else if (normalized.startsWith('select') && normalized.includes('from match_history')) {
    rows = (data.matchHistory || []).filter((entry) => entry.user_id === Number(params[0]));
    rows = rows.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return (b.id || 0) - (a.id || 0);
    });
    if (normalized.includes('limit')) {
      rows = rows.slice(0, 20);
    }
  } else if (normalized.startsWith('select') && normalized.includes('from users')) {
    const target = params[0];
    rows = (data.users || []).filter((user) => {
      if (String(user.id) === String(target)) return true;
      if (String(user.email).toLowerCase() === String(target).toLowerCase()) return true;
      if (String(user.username).toLowerCase() === String(target).toLowerCase()) return true;
      return false;
    });
  } else {
    rows = data.users || [];
  }

  if (callback) callback(null, rows);
  return rows;
}

function sqlNormalize(query) {
  return String(query || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updateUser,
  listUsers,
  updatePlayerStats,
  addFeedback,
  ping,
  run,
  get,
  all,
  serialize: (fn) => fn(),
  close: () => {}
};
