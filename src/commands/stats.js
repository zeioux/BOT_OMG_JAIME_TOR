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