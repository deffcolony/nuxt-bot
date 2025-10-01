import { SlashCommandBuilder, ChatInputCommandInteraction, Client, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('help')
    .setDescription('Lists all available commands or provides info on a specific command.')
    .addStringOption(option =>
        option.setName('command')
            .setDescription('The specific command you want help with.')
            .setRequired(false));

export async function execute(client: Client, interaction: ChatInputCommandInteraction) {
    const commandName = interaction.options.getString('command');
    const commands = client.commands;

    // If no specific command is requested, show all commands
    if (!commandName) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x5865F2) // Discord blurple
            .setTitle('Help Menu')
            .setDescription('Here is a list of all my commands. You can use `/help <command_name>` to get more info on a specific command!')
            .addFields(
                // Dynamically create a field for each command
                commands.map(command => {
                    return {
                        name: `\`/${command.data.name}\``,
                        value: command.data.description,
                        inline: false,
                    };
                })
            );
        
        await interaction.reply({ embeds: [helpEmbed] });
        return;
    }

    // If a specific command is requested, show details for it
    const command = commands.get(commandName.toLowerCase());

    if (!command) {
        await interaction.reply({ content: `❌ Sorry, I couldn't find a command called \`${commandName}\`.`, ephemeral: true });
        return;
    }

    const commandEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Help for: \`/${command.data.name}\``)
        .setDescription(command.data.description);

    // If the command has options, list them
    if (command.data.options.length > 0) {
        const optionsString = command.data.options.map(opt => {
            const optionData = opt.toJSON(); // Use .toJSON() to get full option data
            return `> **\`${optionData.name}\`**: ${optionData.description}\n> *Required: ${optionData.required ? 'Yes' : 'No'}*`;
        }).join('\n\n');

        commandEmbed.addFields({ name: 'Options', value: optionsString });
    }

    await interaction.reply({ embeds: [commandEmbed] });
}