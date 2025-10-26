const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('badges')
        .setDescription('Affiche tous les badges')
        .addUserOption(option =>
            option.setName('membre').setDescription('Voir les badges d\'un membre').setRequired(false)
        ),

    async execute(interaction) {
        const target = interaction.options.getUser('membre') || interaction.user;
        const userBadges = db.getUserBadges(target.id);
        const allBadges = db.db.prepare('SELECT * FROM badges ORDER BY requirement_value ASC').all();

        const earnedIds = new Set(userBadges.map(b => b.badge_id));

        const description = allBadges.map(badge => {
            const earned = earnedIds.has(badge.badge_id);
            const status = earned ? '✅' : '🔒';
            return `${status} ${badge.icon} **${badge.name}**\n└ ${badge.description}`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor(target.id === interaction.user.id ? '#5865F2' : '#99AAB5')
            .setTitle(`🏅 Badges de ${target.username}`)
            .setDescription(description)
            .setFooter({ text: `${userBadges.length}/${allBadges.length} badges débloqués` })
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
