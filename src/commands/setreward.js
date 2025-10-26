const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setreward')
        .setDescription('Gère les récompenses (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub
                .setName('add')
                .setDescription('Ajoute une récompense')
                .addIntegerOption(opt => opt.setName('niveau').setDescription('Niveau').setMinValue(1).setRequired(true))
                .addRoleOption(opt => opt.setName('role').setDescription('Rôle').setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('remove')
                .setDescription('Supprime une récompense')
                .addIntegerOption(opt => opt.setName('niveau').setDescription('Niveau').setMinValue(1).setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('list').setDescription('Liste les récompenses')
        ),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === 'add') {
            const level = interaction.options.getInteger('niveau');
            const role = interaction.options.getRole('role');

            if (role.managed) {
                return interaction.reply({ content: '❌ Rôle géré par une intégration.', ephemeral: true });
            }

            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                return interaction.reply({ content: '❌ Ce rôle est trop haut pour moi.', ephemeral: true });
            }

            db.setReward(level, role.id, role.name);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✅ Récompense Ajoutée')
                .setDescription(`${role} sera attribué au niveau **${level}**.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } else if (sub === 'remove') {
            const level = interaction.options.getInteger('niveau');
            db.deleteReward(level);

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🗑️ Récompense Supprimée')
                .setDescription(`Niveau **${level}** supprimé.`)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } else if (sub === 'list') {
            const rewards = db.getRewards();

            if (!rewards || rewards.length === 0) {
                return interaction.reply({ content: '❌ Aucune récompense configurée.', ephemeral: true });
            }

            const desc = rewards.map(r => {
                const role = interaction.guild.roles.cache.get(r.role_id);
                const roleName = role ? role.toString() : `${r.role_name} (supprimé)`;
                return `**Niveau ${r.level}** → ${roleName}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎁 Récompenses')
                .setDescription(desc)
                .setFooter({ text: `${rewards.length} récompense(s)` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }
};
