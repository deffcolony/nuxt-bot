import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, ChannelType, TextChannel } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { appData } from '../../utils/vars';

interface MousetrapConfig {
    trap: string;
    log?: string;
}

const mousetrapJsonConfig = path.resolve(appData, 'mousetrap-config.json');

// --- Config read/write functions updated for new structure ---

async function readFullConfig(): Promise<Record<string, MousetrapConfig>> {
    try {
        const data = await fs.readFile(mousetrapJsonConfig, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

async function writeFullConfig(config: Record<string, MousetrapConfig>): Promise<void> {
    const dir = path.dirname(mousetrapJsonConfig);
    try {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(mousetrapJsonConfig, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error("[Mousetrap ERROR] Failed to write config:", error);
        throw error;
    }
}


export const data = new SlashCommandBuilder()
    .setName('mousetrap')
    .setDescription('Manages the server\'s anti-spam honeypot channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
        subcommand
            .setName('set')
            .setDescription('Sets a channel as the mousetrap. Anyone who talks here will be banned.')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('The channel to use as the honeypot.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('disable')
            .setDescription('Disables the mousetrap for this server.')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('status')
            .setDescription('Checks the current status of the mousetrap.')
    );

export async function execute(client: Client, interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const config = await readFullConfig();

    if (subcommand === 'set') {
        const channel = interaction.options.getChannel('channel') as TextChannel;
        // Preserve existing log config when setting a new trap channel
        config[guildId] = { ...config[guildId], trap: channel.id };
        await writeFullConfig(config);
        
        await interaction.reply({
            content: `✅ **Mousetrap armed!** Anyone (except admins) who types in ${channel} will be instantly banned.`,
            ephemeral: true
        });
    } else if (subcommand === 'disable') {
        if (config[guildId]) {
            delete config[guildId]; // Delete the entire entry for the guild
            await writeFullConfig(config);
            await interaction.reply({ content: '✅ **Mousetrap disabled.** The honeypot and its logging are no longer active.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'ℹ️ The mousetrap is not currently active on this server.', ephemeral: true });
        }
    } else if (subcommand === 'status') {
        const guildConfig = config[guildId];
        if (guildConfig && guildConfig.trap) {
            let statusMessage = `ℹ️ The mousetrap is active in <#${guildConfig.trap}>.`;
            if (guildConfig.log) {
                statusMessage += `\nBans are being logged to <#${guildConfig.log}>.`;
            } else {
                statusMessage += `\nBan logging is not configured. Use \`/mousetrap-log set\` to enable it.`;
            }
            await interaction.reply({ content: statusMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: 'ℹ️ The mousetrap is not currently active on this server.', ephemeral: true });
        }
    }
}