require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const levels = require('./levels');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Load commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
            console.log(`✅ Loaded command: ${command.data.name}`);
        }
    }
}

// Init database
db.init();

// Cooldowns
const messageCooldowns = new Map();
const COOLDOWN_MS = 5000;

// Ready event
client.once(Events.ClientReady, () => {
    console.log(`✅ Bot prêt: ${client.user.tag}`);
    client.user.setActivity('📊 /stats', { type: 3 });
});

// Message XP
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const now = Date.now();

    if (messageCooldowns.has(userId)) {
        const expiration = messageCooldowns.get(userId) + COOLDOWN_MS;
        if (now < expiration) return;
    }

    messageCooldowns.set(userId, now);
    setTimeout(() => messageCooldowns.delete(userId), COOLDOWN_MS);

    const xp = levels.xpForMessage(message.content);
    const oldData = db.getUser(userId);
    const oldLevel = oldData ? levels.xpToLevel(oldData.total_xp) : 0;

    db.addMessage(userId, message.author.tag, xp);

    const newData = db.getUser(userId);
    const newLevel = levels.xpToLevel(newData.total_xp);

    // Check for level up
    if (newLevel > oldLevel) {
        // Check if it's a milestone (every 10 levels)
        const isMilestone = newLevel % 10 === 0;

        const rewards = db.getRewards();
        const reward = rewards.find(r => r.level === newLevel);

        let rewardMsg = '';
        if (reward) {
            const role = message.guild.roles.cache.get(reward.role_id);
            if (role) {
                try {
                    await message.member.roles.add(role);
                    rewardMsg = `\n🎁 Rôle ${role.name} obtenu !`;
                } catch (err) {
                    console.error('Role error:', err);
                }
            }
        }

        // Send level up message
        if (isMilestone) {
            // Special milestone message with mention
            const embed = new (require('discord.js').EmbedBuilder)()
                .setColor('#FFD700')
                .setTitle('🎊 NIVEAU MILESTONE ATTEINT !')
                .setDescription(
                    `${message.author} vient d'atteindre le **niveau ${newLevel}** ! 🎉\n\n` +
                    `✨ XP Total: ${levels.formatXp(newData.total_xp)}\n` +
                    `💬 Messages: ${newData.message_count}\n` +
                    `🎤 Temps vocal: ${(newData.voice_seconds / 3600).toFixed(2)}h` +
                    rewardMsg
                )
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTimestamp();

            message.channel.send({
                content: `🎉 <@${userId}>`,
                embeds: [embed],
                allowedMentions: { users: [userId] }
            }).catch(() => {});

            // Send DM for milestone
            message.author.send({
                embeds: [embed]
            }).catch(() => {});

        } else {
            // Regular level up message
            message.channel.send({
                content: `🎉 ${message.author} passe niveau **${newLevel}** !${rewardMsg}`,
                allowedMentions: { users: [userId] }
            }).catch(() => {});
        }
    }

    // Check badges
    const newBadges = db.checkAndAwardBadges(userId);
    if (newBadges.length > 0) {
        const badgeNames = newBadges.map(b => `${b.icon} ${b.name}`).join(', ');
        message.author.send(`🏅 Nouveau badge: ${badgeNames}`).catch(() => {});
    }
});

// Voice XP
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    const userId = member.id;
    const ts = Math.floor(Date.now() / 1000);
    const excludedChannelId = process.env.EXCLUDED_VOICE_CHANNEL;

    // User joined voice
    if (!oldState.channel && newState.channel) {
        // Check if channel is excluded
        if (newState.channel.id === excludedChannelId) {
            console.log(`🚫 ${member.user.tag} joined excluded channel, no XP tracking`);
            return;
        }

        // Check if user is muted or deafened
        if (newState.serverMute || newState.serverDeaf || newState.selfMute || newState.selfDeaf) {
            console.log(`🔇 ${member.user.tag} is muted/deafened, no XP tracking`);
            return;
        }

        db.startVoice(userId, member.user.tag, ts);
        console.log(`🎤 ${member.user.tag} joined voice`);
    }

    // User left voice
    else if (oldState.channel && !newState.channel) {
        // Only give XP if they were in a valid channel
        if (oldState.channel.id === excludedChannelId) {
            console.log(`🚫 ${member.user.tag} left excluded channel, no XP awarded`);
            return;
        }

        const result = db.endVoice(userId, ts, levels.xpForVoiceMinute());

        if (result) {
            const minutes = Math.floor(result.duration / 60);
            console.log(`🎤 ${member.user.tag} left voice: ${minutes}min, ${result.xp} XP`);

            member.user.send(
                `🎤 Session vocale terminée !\n` +
                `⏱️ Durée: ${minutes} minutes\n` +
                `✨ XP gagné: ${result.xp}`
            ).catch(() => {});

            // Check badges
            const newBadges = db.checkAndAwardBadges(userId);
            if (newBadges.length > 0) {
                const badgeNames = newBadges.map(b => `${b.icon} ${b.name}`).join(', ');
                member.user.send(`🏅 Nouveau badge: ${badgeNames}`).catch(() => {});
            }
        }
    }

    // User state changed (mute/unmute, deaf/undeaf) while in channel
    else if (oldState.channel && newState.channel) {
        const excludedChannel = newState.channel.id === excludedChannelId;
        const wasMuted = oldState.serverMute || oldState.serverDeaf || oldState.selfMute || oldState.selfDeaf;
        const isMuted = newState.serverMute || newState.serverDeaf || newState.selfMute || newState.selfDeaf;

        // User got muted/deafened or entered excluded channel - stop tracking
        if ((!wasMuted && isMuted) || (!excludedChannel && excludedChannel)) {
            const result = db.endVoice(userId, ts, levels.xpForVoiceMinute());
            if (result) {
                console.log(`🔇 ${member.user.tag} got muted/moved to excluded, stopped tracking`);
            }
        }

        // User got unmuted/undeafened and not in excluded channel - start tracking
        else if (wasMuted && !isMuted && !excludedChannel) {
            db.startVoice(userId, member.user.tag, ts);
            console.log(`🔊 ${member.user.tag} got unmuted, started tracking`);
        }
    }
});

// Interactions
client.on(Events.InteractionCreate, async (interaction) => {
    // Slash commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('Command error:', error);
            const reply = { content: '❌ Erreur lors de l\'exécution.', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }
    }

    // Button interactions
    else if (interaction.isButton()) {
        const [action, param, userId] = interaction.customId.split('_');

        if (action === 'badges') {
            const userBadges = db.getUserBadges(param);
            const allBadges = db.db.prepare('SELECT * FROM badges').all();
            const earnedIds = new Set(userBadges.map(b => b.badge_id));

            const desc = allBadges.map(b => {
                const earned = earnedIds.has(b.badge_id);
                const status = earned ? '✅' : '🔒';
                return `${status} ${b.icon} **${b.name}**`;
            }).join('\n');

            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🏅 Badges')
                .setDescription(desc)
                .setFooter({ text: `${userBadges.length}/${allBadges.length} débloqués` });

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        else if (action === 'rank') {
            const user = db.getUser(param);
            if (!user) {
                return interaction.reply({ content: '❌ Données introuvables', ephemeral: true });
            }

            const allUsers = db.getLeaderboard(1000);
            const rank = allUsers.findIndex(u => u.user_id === param) + 1;

            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📊 Classement')
                .setDescription(
                    `**Position:** #${rank}\n` +
                    `**XP:** ${levels.formatXp(user.total_xp)}\n` +
                    `**Niveau:** ${levels.xpToLevel(user.total_xp)}`
                );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }

        else if (action === 'prestige' && param === 'confirm') {
            if (userId !== interaction.user.id) {
                return interaction.reply({ content: '❌ Pas ton prestige!', ephemeral: true });
            }

            const result = db.prestigeUser(userId);
            if (!result) {
                return interaction.reply({ content: '❌ Erreur prestige', ephemeral: true });
            }

            const { EmbedBuilder } = require('discord.js');
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('⭐ Prestige Réussi!')
                .setDescription(
                    `Prestige **${result.prestigeLevel}** !\n\n` +
                    `Ancien XP: ${levels.formatXp(result.oldXp)}\n` +
                    `Nouveau XP: ${levels.formatXp(result.newXp)}\n` +
                    `Bonus: ${levels.formatXp(result.bonus)}`
                );

            await interaction.update({ embeds: [embed], components: [] });
        }

        else if (action === 'prestige' && param === 'cancel') {
            await interaction.update({
                content: '❌ Prestige annulé.',
                embeds: [],
                components: []
            });
        }
    }
});

// Start web server
require('./web/server');

// Login
client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error('❌ Login failed:', err);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    client.destroy();
    process.exit(0);
});
