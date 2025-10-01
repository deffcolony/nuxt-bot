import { Client, Message, PermissionFlagsBits, ChannelType, EmbedBuilder, TextChannel } from "discord.js";
import path from "path";
import { appData } from "../../utils/vars";

interface MousetrapConfig {
    trap: string;
    log?: string;
}

const mousetrapJsonConfig = path.resolve(appData, 'mousetrap-config.json');

export default async function (client: Client, message: Message) {
    if (!message.guild || message.author.bot || message.channel.type !== ChannelType.GuildText) {
        return;
    }

    let fullConfig: Record<string, MousetrapConfig>;
    try {
        delete require.cache[require.resolve(mousetrapJsonConfig)];
        fullConfig = require(mousetrapJsonConfig);
    } catch (e) {
        return;
    }

    const guildConfig = fullConfig[message.guildId];
    if (!guildConfig || message.channel.id !== guildConfig.trap) {
        return;
    }

    // --- MODERATOR AND ADMIN IMMUNITY CHECK ---
    if (message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
        await message.delete().catch(err => {
            console.error(`[Mousetrap] Could not delete moderator's message: ${err}`);
        });

        try {
            // --- MODIFICATION: Use a clickable channel link ---
            // The format <#CHANNEL_ID> creates a link to that channel.
            await message.author.send(
                `🔔 **Heads up!** You just sent a message in the mousetrap channel (<#${message.channel.id}>) on the server **${message.guild.name}**.` +
                `\n\nBecause you have moderator permissions, I have deleted your message but have **not** banned you.`
            );
        } catch (dmError) {
            console.warn(`[Mousetrap] Could not DM moderator ${message.author.tag}. They may have DMs disabled.`);
        }
        
        return;
    }

    // --- BAN LOGIC FOR NORMAL USERS ---
    try {
        const userToBan = message.member;
        const author = message.author;
        const reason = 'Triggered the anti-spam mousetrap channel.';

        if (guildConfig.log) {
            try {
                const logChannel = await client.channels.fetch(guildConfig.log) as TextChannel;
                if (logChannel) {
                    const logEmbed = new EmbedBuilder()
                        .setColor(0xFF4C4C)
                        .setTitle(' Mousetrap Activated: User Banned')
                        .addFields(
                            // --- MODIFICATION: Use a clickable user mention ---
                            // The format <@USER_ID> creates a link to their profile.
                            { name: '👤 User', value: `${author.tag} (<@${author.id}>)`, inline: false },
                            
                            // --- MODIFICATION: Mention the bot as the one who banned ---
                            { name: '🛡️ Banned By', value: `<@${client.user.id}>`, inline: false },
                            
                            // Using ${message.channel} here automatically converts it to a <#CHANNEL_ID> mention
                            { name: '#️⃣ Trap Channel', value: `${message.channel}`, inline: true },
                            { name: '✍️ Trigger Message', value: `\`\`\`${message.content.substring(0, 1020) || '[No Content]'}\`\`\``, inline: false }
                        )
                        .setTimestamp();
                    
                    await logChannel.send({ embeds: [logEmbed] });
                }
            } catch (logError) {
                console.error(`[Mousetrap ERROR] Could not send log for guild ${message.guildId}. Error:`, logError);
            }
        }

        await author.send(`You have been banned from **${message.guild.name}** for posting in a channel reserved for spam detection.`).catch(() => {
            console.warn(`[Mousetrap] Could not DM user ${author.tag} before banning.`);
        });

        if (userToBan && userToBan.bannable) {
            await userToBan.ban({ deleteMessageSeconds: 3600, reason });
        } else {
             console.error(`[Mousetrap ERROR] Could not ban ${author.tag}. They may have a higher role or I lack permissions.`);
        }

    } catch (error) {
        console.error(`[Mousetrap FATAL] Failed to execute ban for ${message.author.tag}. Error:`, error);
    }
}