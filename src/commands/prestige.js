const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../db');
const levels = require('../levels');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('prestige')
        .setDescription('Réinitialise ton niveau pour un bonus permanent'),

    async execute(interaction) {
        const user = db.getUser(interaction.user.id);

        if (!user) {
            return interaction.reply({ content: '❌ Aucune donnée.', ephemeral: true });
        }

        const currentLevel = levels.xpToLevel(user.total_xp);

        if (currentLevel < 25) {
            return interaction.reply({
                content: `❌ Prestige disponible au niveau 25. Tu es niveau ${currentLevel}.`,
                ephemeral: true
            });
        }

        const bonus = Math.floor(user.total_xp * 0.1);
        const newXp = 100 + bonus;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('⭐ Prestige')
            .setDescription(
                `**Conditions:**\n` +
                `• Niveau: **${currentLevel}**\n` +
                `• XP: **${levels.formatXp(user.total_xp)}**\n` +
                `• Prestige: **${user.prestige_level}**\n\n` +
                `**Après prestige:**\n` +
                `• Niveau: **1**\n` +
                `• XP: **${levels.formatXp(newXp)}** (bonus: ${levels.formatXp(bonus)})\n` +
                `• Prestige: **${user.prestige_level + 1}** ⭐\n\n` +
                `⚠️ **Irréversible !**`
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`prestige_confirm_${interaction.user.id}`)
                .setLabel('✅ Confirmer')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`prestige_cancel_${interaction.user.id}`)
                .setLabel('❌ Annuler')
                .setStyle(ButtonStyle.Danger)
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }
};