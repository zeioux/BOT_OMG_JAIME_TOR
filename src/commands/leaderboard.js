const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const levels = require('../levels');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Affiche le classement')
        .addIntegerOption(option =>
            option
                .setName('top')
                .setDescription('Nombre de membres (5-25)')
                .setMinValue(5)
                .setMaxValue(25)
                .setRequired(false)
        ),

    async execute(interaction) {
        const limit = interaction.options.getInteger('top') || 10;
        const users = db.getLeaderboard(limit);

        if (!users || users.length === 0) {
            return interaction.reply({ content: '❌ Aucune donnée disponible.', ephemeral: true });
        }

        const medals = ['🥇', '🥈', '🥉'];
        const description = users.map((u, i) => {
            const medal = i < 3 ? medals[i] : `**${i + 1}.**`;
            const prestige = u.prestige_level > 0 ? ` ⭐×${u.prestige_level}` : '';
            const level = levels.xpToLevel(u.total_xp);
            return `${medal} **${u.username}**${prestige}\n└ ${levels.formatXp(u.total_xp)} XP • Lvl ${level}`;
        }).join('\n\n');

        const userRank = users.findIndex(u => u.user_id === interaction.user.id);
        let footer = `Top ${limit} membres`;
        if (userRank !== -1) {
            footer += ` • Tu es #${userRank + 1}`;
        }

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🏆 Leaderboard')
            .setDescription(description)
            .setFooter({ text: footer })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
