import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Checks the bot\'s latency and response time.');

export async function execute(client: Client, interaction: ChatInputCommandInteraction) {

    // Step 1: Send the initial reply. This no longer returns the message object directly.
    await interaction.reply({ content: '🏓 Pinging...' });

    // Step 2: Explicitly fetch the reply message we just sent.
    const sent = await interaction.fetchReply();
    
    // Now the logic is the same, but using the fetched message.
    const apiLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
        .setColor(0x00FF00) // Green
        .setTitle('🏓 Pong!')
        .addFields(
            { name: 'API Latency', value: `**${apiLatency}ms**`, inline: true },
            { name: 'WebSocket Ping', value: `**${wsPing}ms**`, inline: true }
        )
        .setTimestamp();

    // Edit the original reply with the results
    await interaction.editReply({ content: '', embeds: [embed] });
}