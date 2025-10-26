require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('../db');
const levels = require('../levels');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../web')));

// API Routes
app.get('/api/leaderboard', (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const users = db.getLeaderboard(limit);
    const data = users.map(u => ({
        user_id: u.user_id,
        username: u.username,
        xp: u.total_xp,
        level: levels.xpToLevel(u.total_xp),
        messages: u.message_count,
        voice_hours: (u.voice_seconds / 3600).toFixed(2),
        prestige: u.prestige_level
    }));
    res.json(data);
});

app.get('/api/user/:id', (req, res) => {
    const user = db.getUser(req.params.id);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    const levelInfo = levels.getLevelProgress(user.total_xp);
    const badges = db.getUserBadges(req.params.id);

    res.json({
        user_id: user.user_id,
        username: user.username,
        xp: user.total_xp,
        level: levelInfo.currentLevel,
        progress: levelInfo.progress,
        needed: levelInfo.needed,
        percentage: levelInfo.percentage,
        messages: user.message_count,
        voice_hours: (user.voice_seconds / 3600).toFixed(2),
        prestige: user.prestige_level,
        badges: badges.map(b => ({ icon: b.icon, name: b.name }))
    });
});

app.get('/api/stats', (req, res) => {
    const totalUsers = db.db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalMessages = db.db.prepare('SELECT SUM(message_count) as count FROM users').get().count || 0;
    const totalVoiceHours = db.db.prepare('SELECT SUM(voice_seconds) as total FROM users').get().total / 3600 || 0;

    res.json({
        total_users: totalUsers,
        total_messages: totalMessages,
        total_voice_hours: totalVoiceHours.toFixed(2)
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
});