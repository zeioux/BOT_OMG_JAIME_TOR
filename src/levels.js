const BASE = 100;

function xpForMessage(content) {
    const len = content ? content.trim().length : 0;
    let xp = 10;
    if (len > 50) xp += 5;
    if (len > 100) xp += 5;
    if (len > 200) xp += 10;
    return Math.min(50, Math.max(5, xp));
}

function xpForVoiceMinute() {
    return 5;
}

function xpToLevel(xp) {
    return Math.floor(Math.sqrt(xp / BASE));
}

function levelToXp(level) {
    return level * level * BASE;
}

function getLevelProgress(xp) {
    const currentLevel = xpToLevel(xp);
    const currentLevelXp = levelToXp(currentLevel);
    const nextLevelXp = levelToXp(currentLevel + 1);

    const progress = xp - currentLevelXp;
    const needed = nextLevelXp - currentLevelXp;
    const percentage = (progress / needed) * 100;

    return {
        currentLevel,
        currentXp: xp,
        currentLevelXp,
        nextLevelXp,
        progress,
        needed,
        percentage: Math.min(100, Math.max(0, percentage))
    };
}

function progressBar(current, needed, length = 20) {
    const ratio = Math.min(1, Math.max(0, current / needed));
    const filled = Math.round(ratio * length);
    const bar = '█'.repeat(filled) + '░'.repeat(length - filled);
    return `${bar} ${Math.round(ratio * 100)}%`;
}

function formatXp(xp) {
    if (xp >= 1000000) return `${(xp / 1000000).toFixed(1)}M`;
    if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
    return xp.toString();
}

module.exports = {
    xpForMessage,
    xpForVoiceMinute,
    xpToLevel,
    levelToXp,
    getLevelProgress,
    progressBar,
    formatXp
};
