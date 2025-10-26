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

// ============================================
// FILE: src/commands/stats.js
// ============================================
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const levels = require('../levels');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Affiche tes statistiques')
        .addUserOption(option =>
            option.setName('membre').setDescription('Membre à consulter').setRequired(false)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('membre') || interaction.user;
        const user = db.getUser(target.id);

        if (!user) {
            return interaction.reply({ content: '❌ Aucune donnée pour cet utilisateur.', ephemeral: true });
        }

        const levelInfo = levels.getLevelProgress(user.total_xp);
        const badges = db.getUserBadges(target.id);
        const voiceHours = (user.voice_seconds / 3600).toFixed(2);

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📊 Statistiques de ${user.username}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                {
                    name: '🎖️ Niveau',
                    value: `**${levelInfo.currentLevel}**${user.prestige_level > 0 ? ` ⭐×${user.prestige_level}` : ''}`,
                    inline: true
                },
                {
                    name: '✨ XP Total',
                    value: `**${levels.formatXp(user.total_xp)}**`,
                    inline: true
                },
                {
                    name: '📈 Progression',
                    value: `${levels.progressBar(levelInfo.progress, levelInfo.needed)}\n${levels.formatXp(levelInfo.progress)}/${levels.formatXp(levelInfo.needed)} XP`,
                    inline: false
                },
                {
                    name: '💬 Messages',
                    value: `**${user.message_count.toLocaleString()}**`,
                    inline: true
                },
                {
                    name: '🎤 Temps Vocal',
                    value: `**${voiceHours}h**`,
                    inline: true
                },
                {
                    name: '🏅 Badges',
                    value: badges.length > 0 ? badges.slice(0, 10).map(b => b.icon).join(' ') : 'Aucun badge',
                    inline: true
                }
            )
            .setFooter({ text: `Membre depuis ${new Date(user.created_at * 1000).toLocaleDateString('fr-FR')}` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`badges_${target.id}`)
                .setLabel('Voir Badges')
                .setEmoji('🏅')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`rank_${target.id}`)
                .setLabel('Mon Rang')
                .setEmoji('📊')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
    }
};