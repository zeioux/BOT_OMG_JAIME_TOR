const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'bot.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

function init() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      total_xp INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      voice_seconds INTEGER DEFAULT 0,
      last_voice_join INTEGER DEFAULT NULL,
      last_message_ts INTEGER DEFAULT NULL,
      prestige_level INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    
    CREATE TABLE IF NOT EXISTS voice_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      start_ts INTEGER NOT NULL,
      end_ts INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      xp_earned INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS rewards (
      level INTEGER PRIMARY KEY,
      role_id TEXT NOT NULL,
      role_name TEXT
    );
    
    CREATE TABLE IF NOT EXISTS badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      badge_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      icon TEXT,
      requirement_type TEXT NOT NULL,
      requirement_value INTEGER NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS user_badges (
      user_id TEXT NOT NULL,
      badge_id TEXT NOT NULL,
      earned_at INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (user_id, badge_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_users_xp ON users(total_xp DESC);
    CREATE INDEX IF NOT EXISTS idx_voice_sessions_user ON voice_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
  `);

    initializeBadges();
    console.log('✅ Database initialized');
}

function initializeBadges() {
    const badges = [
        { badge_id: 'first_msg', name: 'Premier Pas', description: 'Envoie ton premier message', icon: '📝', type: 'messages', value: 1 },
        { badge_id: 'chatty', name: 'Bavard', description: 'Envoie 100 messages', icon: '💬', type: 'messages', value: 100 },
        { badge_id: 'veteran', name: 'Vétéran', description: 'Envoie 1000 messages', icon: '🎖️', type: 'messages', value: 1000 },
        { badge_id: 'voice_1h', name: 'Vocal Débutant', description: 'Passe 1h en vocal', icon: '🎤', type: 'voice_hours', value: 1 },
        { badge_id: 'voice_10h', name: 'Vocal Pro', description: 'Passe 10h en vocal', icon: '🎧', type: 'voice_hours', value: 10 },
        { badge_id: 'voice_100h', name: 'Vocal Légende', description: 'Passe 100h en vocal', icon: '👑', type: 'voice_hours', value: 100 },
        { badge_id: 'level_5', name: 'Niveau 5', description: 'Atteins le niveau 5', icon: '⭐', type: 'level', value: 5 },
        { badge_id: 'level_10', name: 'Niveau 10', description: 'Atteins le niveau 10', icon: '🌟', type: 'level', value: 10 },
        { badge_id: 'level_25', name: 'Niveau 25', description: 'Atteins le niveau 25', icon: '✨', type: 'level', value: 25 },
        { badge_id: 'level_50', name: 'Niveau 50', description: 'Atteins le niveau 50', icon: '💫', type: 'level', value: 50 }
    ];

    const insert = db.prepare('INSERT OR IGNORE INTO badges(badge_id, name, description, icon, requirement_type, requirement_value) VALUES(?, ?, ?, ?, ?, ?)');
    for (const b of badges) {
        insert.run(b.badge_id, b.name, b.description, b.icon, b.type, b.value);
    }
}

const stmts = {
    ensureUser: db.prepare('INSERT OR IGNORE INTO users(user_id, username) VALUES(?, ?)'),
    updateUsername: db.prepare('UPDATE users SET username = ? WHERE user_id = ?'),
    addMessage: db.prepare('UPDATE users SET message_count = message_count + 1, total_xp = total_xp + ?, last_message_ts = ? WHERE user_id = ?'),
    startVoice: db.prepare('UPDATE users SET last_voice_join = ? WHERE user_id = ?'),
    endVoice: db.prepare('UPDATE users SET voice_seconds = voice_seconds + ?, total_xp = total_xp + ?, last_voice_join = NULL WHERE user_id = ?'),
    insertVoiceSession: db.prepare('INSERT INTO voice_sessions(user_id, start_ts, end_ts, duration, xp_earned) VALUES(?, ?, ?, ?, ?)'),
    getUser: db.prepare('SELECT * FROM users WHERE user_id = ?'),
    getLeaderboard: db.prepare('SELECT user_id, username, total_xp, message_count, voice_seconds, prestige_level FROM users ORDER BY total_xp DESC LIMIT ?'),
    setReward: db.prepare('INSERT OR REPLACE INTO rewards(level, role_id, role_name) VALUES(?, ?, ?)'),
    getRewards: db.prepare('SELECT level, role_id, role_name FROM rewards ORDER BY level ASC'),
    deleteReward: db.prepare('DELETE FROM rewards WHERE level = ?'),
    prestige: db.prepare('UPDATE users SET total_xp = ?, prestige_level = prestige_level + 1 WHERE user_id = ?')
};

function ensureUser(userId, username) {
    stmts.ensureUser.run(userId, username);
    stmts.updateUsername.run(username, userId);
}

function addMessage(userId, username, xp) {
    ensureUser(userId, username);
    stmts.addMessage.run(xp, Math.floor(Date.now() / 1000), userId);
}

function startVoice(userId, username, ts) {
    ensureUser(userId, username);
    stmts.startVoice.run(ts, userId);
}

function endVoice(userId, ts, xpPerMinute) {
    const user = stmts.getUser.get(userId);
    if (!user || !user.last_voice_join) return null;

    const duration = Math.max(0, ts - user.last_voice_join);
    const xp = Math.floor((duration / 60) * xpPerMinute);

    stmts.endVoice.run(duration, xp, userId);
    stmts.insertVoiceSession.run(userId, user.last_voice_join, ts, duration, xp);

    return { duration, xp };
}

function getUser(userId) {
    return stmts.getUser.get(userId);
}

function getLeaderboard(limit = 10) {
    return stmts.getLeaderboard.all(limit);
}

function setReward(level, roleId, roleName) {
    stmts.setReward.run(level, roleId, roleName);
}

function getRewards() {
    return stmts.getRewards.all();
}

function deleteReward(level) {
    stmts.deleteReward.run(level);
}

function prestigeUser(userId) {
    const user = getUser(userId);
    if (!user) return null;

    const bonus = Math.floor(user.total_xp * 0.1);
    const newXp = 100 + bonus;

    stmts.prestige.run(newXp, userId);

    return {
        oldXp: user.total_xp,
        newXp: newXp,
        bonus: bonus,
        prestigeLevel: user.prestige_level + 1
    };
}

function checkAndAwardBadges(userId) {
    const user = getUser(userId);
    if (!user) return [];

    const level = require('./levels').xpToLevel(user.total_xp);
    const voiceHours = user.voice_seconds / 3600;

    const badges = db.prepare(`
    SELECT b.* FROM badges b
    LEFT JOIN user_badges ub ON b.badge_id = ub.badge_id AND ub.user_id = ?
    WHERE ub.badge_id IS NULL
  `).all(userId);

    const earned = [];

    for (const badge of badges) {
        let qualifies = false;

        switch (badge.requirement_type) {
            case 'messages':
                qualifies = user.message_count >= badge.requirement_value;
                break;
            case 'voice_hours':
                qualifies = voiceHours >= badge.requirement_value;
                break;
            case 'level':
                qualifies = level >= badge.requirement_value;
                break;
        }

        if (qualifies) {
            db.prepare('INSERT OR IGNORE INTO user_badges(user_id, badge_id) VALUES(?, ?)').run(userId, badge.badge_id);
            earned.push(badge);
        }
    }

    return earned;
}

function getUserBadges(userId) {
    return db.prepare(`
    SELECT b.* FROM badges b
    JOIN user_badges ub ON b.badge_id = ub.badge_id
    WHERE ub.user_id = ?
    ORDER BY ub.earned_at DESC
  `).all(userId);
}

module.exports = {
    init,
    addMessage,
    startVoice,
    endVoice,
    getUser,
    getLeaderboard,
    setReward,
    getRewards,
    deleteReward,
    prestigeUser,
    checkAndAwardBadges,
    getUserBadges
};
