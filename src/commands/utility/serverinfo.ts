import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, Guild, ChannelType, PermissionFlagsBits, GuildVerificationLevel, GuildExplicitContentFilter } from 'discord.js';

// Helper function to format enum keys (e.g., 'Level1' -> 'Level 1')
function formatEnum(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

export const data = new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Displays detailed information about the current server.');

export async function execute(client: Client, interaction: ChatInputCommandInteraction) {
    if (!interaction.inGuild()) {
        await (interaction as ChatInputCommandInteraction).reply({ content: 'This command can only be used inside a server.', ephemeral: true });
        return;
    }

    await interaction.deferReply();

    // Fetch the full guild object to ensure all data is available
    const guild = await interaction.guild.fetch();

    // Fetch owner, roles, and channels
    const owner = await guild.fetchOwner();
    const roles = await guild.roles.fetch();
    const channels = await guild.channels.fetch();

    // Fetch bans (requires permissions)
    let banCount = 'Unknown';
    if (guild.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
        try {
            const bans = await guild.bans.fetch();
            banCount = bans.size.toString();
        } catch (error) {
            console.error("Could not fetch ban count:", error);
            banCount = 'Permission Error';
        }
    } else {
        banCount = 'Missing Permissions';
    }

    // Channel counts
    const textChannels = channels.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = channels.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = channels.filter(c => c.type === ChannelType.GuildCategory).size;
    const forumChannels = channels.filter(c => c.type === ChannelType.GuildForum).size;

    // Create the main embed
    const infoEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Server Info: ${guild.name}`)
        .setThumbnail(guild.iconURL({ size: 512 }))
        .addFields(
            // --- General Info ---
            { name: '📋 Name', value: guild.name, inline: true },
            { name: '🆔 ID', value: guild.id, inline: true },
            { name: '👑 Owner', value: `${owner.user.tag} (${owner.id})`, inline: false },
            { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false },
            
            // --- Counts ---
            { name: '👥 Members', value: `**${guild.memberCount}** total`, inline: true },
            { name: '🎭 Roles', value: `**${roles.size}** roles`, inline: true },
            { name: '🔨 Banned Users', value: `**${banCount}** users`, inline: true },

            // --- Channel Counts ---
            { name: 'Channels', value: `**${channels.size}** total`, inline: true },
            { name: '├─ ✍️ Text', value: `${textChannels}`, inline: true },
            { name: '├─ 🗣️ Voice', value: `${voiceChannels}`, inline: true },
            { name: '├─ 📁 Categories', value: `${categories}`, inline: true },
            { name: '└─ 📰 Forums', value: `${forumChannels}`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true }, // Spacer

            // --- Server Boost Status ---
            { name: '✨ Boost Tier', value: `Tier **${guild.premiumTier}**`, inline: true },
            { name: '💎 Boosts', value: `**${guild.premiumSubscriptionCount ?? 0}** boosts`, inline: true },
            { name: '\u200B', value: '\u200B', inline: true }, // Spacer

            // --- Security ---
            { name: '🔒 Verification', value: formatEnum(GuildVerificationLevel[guild.verificationLevel]), inline: true },
            { name: '🔞 Content Filter', value: formatEnum(GuildExplicitContentFilter[guild.explicitContentFilter]), inline: true },
        )
        .setFooter({ text: `Requested by ${interaction.user.tag}` })
        .setTimestamp();

    await interaction.editReply({ embeds: [infoEmbed] });
}