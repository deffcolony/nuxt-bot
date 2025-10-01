import { SlashCommandBuilder, ChatInputCommandInteraction, Client, PermissionFlagsBits, ChannelType, TextChannel } from 'discord.js';
import fs from 'fs/promises';
import path from 'path';
import { appData } from '../../utils/vars';

// Define the shape of our config object for a single guild
interface MousetrapConfig {
    trap: string;
    log?: string; // Log channel is optional
}

const mousetrapJsonConfig = path.resolve(appData, 'mousetrap-config.json');

// --- Configuration Read/Write Functions ---
// These now handle the new object-based structure

async function readFullConfig(): Promise<Record<string, MousetrapConfig>> {
    try {
        const data = await fs.readFile(mousetrapJsonConfig, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return {}; // Return empty object if file doesn't exist or is invalid
    }
}

async function writeFullConfig(config: Record<string, MousetrapConfig>): Promise<void> {
    const dir = path.dirname(mousetrapJsonConfig);
    try {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(mousetrapJsonConfig, JSON.stringify(config, null, 2));
    } catch (error) {
        console.error("[MousetrapLog ERROR] Failed to write config:", error);
        throw error;
    }
}

export const data = new SlashCommandBuilder()
    .setName('mousetrap-log')
    .setDescription('Manages the logging channel for the mousetrap.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
        subcommand
            .setName('set')
            .setDescription('Sets a channel to log mousetrap bans.')
            .addChannelOption(option =>
                option.setName('channel')
                    .setDescription('The channel where ban logs should be sent.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('disable')
            .setDescription('Disables logging for the mousetrap on this server.')
    );

export async function execute(client: Client, interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const config = await readFullConfig();

    // Check if a mousetrap is configured at all
    if (!config[guildId] || !config[guildId].trap) {
        await interaction.reply({ 
            content: '⚠️ You must set a mousetrap channel first using `/mousetrap set` before you can configure logging.',
            ephemeral: true
        });
        return;
    }

    if (subcommand === 'set') {
        const channel = interaction.options.getChannel('channel') as TextChannel;
        config[guildId].log = channel.id; // Set/update the log property
        await writeFullConfig(config);
        
        await interaction.reply({
            content: `✅ **Log Channel Set!** Mousetrap bans will now be logged in ${channel}.`,
            ephemeral: true
        });
    } else if (subcommand === 'disable') {
        if (config[guildId].log) {
            delete config[guildId].log; // Remove the log property
            await writeFullConfig(config);
            await interaction.reply({ content: '✅ **Mousetrap logging disabled.**', ephemeral: true });
        } else {
            await interaction.reply({ content: 'ℹ️ Mousetrap logging is not currently active on this server.', ephemeral: true });
        }
    }
}