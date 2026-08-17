const db = require('../config');
const userModel = require('../models/userModel');

// Lightweight achievement definitions (can be expanded/seeded later)
const ACHIEVEMENT_DEFS = [
  {
    key: 'first_victory',
    name: 'First Victory',
    description: 'Win your first battle.',
    icon: 'fa-solid fa-trophy',
    category: 'battle',
    requirement_type: 'wins',
    requirement_value: 1,
    reward_exp: 50,
    is_active: 1
  },
  {
    key: 'win_streak_5',
    name: 'On Fire',
    description: 'Win 5 battles in a row.',
    icon: 'fa-solid fa-fire',
    category: 'win_streak',
    requirement_type: 'win_streak',
    requirement_value: 5,
    reward_exp: 80,
    is_active: 1
  },
  {
    key: 'perfect_match',
    name: 'Perfect Match',
    description: 'Answer every question correctly in a battle.',
    icon: 'fa-solid fa-star',
    category: 'accuracy',
    requirement_type: 'perfect_match',
    requirement_value: 1,
    reward_exp: 100,
    is_active: 1
  }
];

function ensureDefinitionsSeeded() {
  // Insert definitions if not present (idempotent)
  ACHIEVEMENT_DEFS.forEach((a) => {
    db.get(`SELECT id FROM achievements WHERE key_name = ?`, [a.key], (err, row) => {
      if (err) return;
      if (!row) {
        db.run(
          `INSERT INTO achievements (key_name, name, description, icon, category, requirement_type, requirement_value, reward_exp, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [a.key, a.name, a.description, a.icon, a.category, a.requirement_type, a.requirement_value, a.reward_exp, a.is_active]
        );
      }
    });
  });
}

function awardAchievementIfEligible(userId, achievementKey, callback) {
  // Get achievement definition
  db.get(`SELECT * FROM achievements WHERE key_name = ? AND is_active = 1`, [achievementKey], (err, ach) => {
    if (err || !ach) return callback && callback(err || null, false);
    // check if already unlocked
    db.get(`SELECT id, unlocked_at FROM user_achievements WHERE user_id = ? AND achievement_id = ?`, [userId, ach.id], (err2, ua) => {
      if (err2) return callback && callback(err2, false);
      if (ua && ua.unlocked_at) return callback && callback(null, false); // already unlocked
      // try to insert or update unlocked
      const now = new Date().toISOString();
      db.run(`INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE progress = ?, unlocked_at = IF(unlocked_at IS NULL, VALUES(unlocked_at), unlocked_at)`,
        [userId, ach.id, ach.requirement_value, now, ach.requirement_value], function(err3) {
          if (err3) return callback && callback(err3, false);
          // grant reward EXP if defined
          if (ach.reward_exp && ach.reward_exp > 0) {
            db.run(`UPDATE users SET exp = exp + ? WHERE id = ?`, [ach.reward_exp, userId], (err4) => {
              if (err4) return callback && callback(err4, true);
              return callback && callback(null, true);
            });
          } else {
            return callback && callback(null, true);
          }
        }
      );
    });
  });
}

async function evaluateForMatch(userId, matchRow, callback) {
  // matchRow: object containing isWin (boolean/null), details (array), subject, mode
  try {
    // Fetch fresh profile
    userModel.getUserProfile(userId, (err, profile) => {
      if (err || !profile) return callback && callback(err || new Error('user not found'));

      const promises = [];
      // First victory
      if (matchRow.isWin === true && (Number(profile.wins) || 0) >= 1) {
        promises.push(new Promise((res) => awardAchievementIfEligible(userId, 'first_victory', (e, ok) => res({ e, ok }))));
      }

      // Perfect match
      if (Array.isArray(matchRow.details) && matchRow.details.length > 0) {
        const allCorrect = matchRow.details.every(d => !!d.isCorrect);
        if (allCorrect) {
          promises.push(new Promise((res) => awardAchievementIfEligible(userId, 'perfect_match', (e, ok) => res({ e, ok }))));
        }
      }

      // Win streak (we don't have explicit current streak stored; approximate by checking recent matches)
      db.all(`SELECT is_win FROM match_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`, [userId, 10], (err2, rows) => {
        const recent = (rows || []).map(r => Number(r.is_win) === 1);
        let streak = 0;
        for (const w of recent) {
          if (w) streak++; else break;
        }
        if (streak >= 5) {
          promises.push(new Promise((res) => awardAchievementIfEligible(userId, 'win_streak_5', (e, ok) => res({ e, ok }))));
        }

        Promise.all(promises).then(results => {
          return callback && callback(null, results);
        }).catch((e) => callback && callback(e));
      });
    });
  } catch (e) {
    return callback && callback(e);
  }
}

module.exports = {
  ensureDefinitionsSeeded,
  awardAchievementIfEligible,
  evaluateForMatch,
  ACHIEVEMENT_DEFS
};
