import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    Client, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuInteraction,
    ComponentType,
    PermissionFlagsBits
} from 'discord.js';
import { searchDocs, syncDocs } from '../../utils/docManager';

export const data = new SlashCommandBuilder()
    .setName('docs')
    .setDescription('Access the Nuxt documentation.')
    .addSubcommand(sub => 
        sub.setName('search')
           .setDescription('Search the official docs.')
           .addStringOption(opt => opt.setName('query').setDescription('Topic (e.g. routing, fetch)').setRequired(true))
    )
    .addSubcommand(sub => 
        sub.setName('sync')
           .setDescription('Force update the documentation cache.')
    );

export async function execute(client: Client, interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    // --- SYNC COMMAND ---
    if (subcommand === 'sync') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: '❌ Only admins can sync docs.', ephemeral: true });
        }
        await interaction.reply({ content: '🔄 **Syncing Nuxt docs...**' });
        try {
            await syncDocs();
            await interaction.editReply({ content: '✅ **Sync Complete!** Documentation is up to date.' });
        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Failed to sync. Check console logs.' });
        }
        return;
    }

    // --- SEARCH COMMAND ---
    await interaction.deferReply();
    const query = interaction.options.getString('query', true);
    
    // Perform search
    const results = await searchDocs(query);

    if (results.length === 0) {
        return interaction.editReply({ content: `❌ No documentation results found for **"${query}"**.` });
    }

    // --- BUILD UI ---
    const generateMessage = (index: number) => {
        const item = results[index];
        
        const embed = new EmbedBuilder()
            .setColor(0x00DC82) // Nuxt Green
            .setTitle(`📚 ${item.title}`)
            .setURL(item.url)
            .setDescription(`**Match Preview:**\n"${item.snippet}"\n\n🔗 [**Read Full Page**](${item.url})`)
            .setFooter({ text: `Result ${index + 1} of ${results.length} • Score: ${item.score}` });

        // Create Dropdown
        const options = results.slice(0, 10).map((res, i) => ({
            label: res.title.substring(0, 100),
            description: res.snippet.substring(0, 50) + '...',
            value: i.toString(),
            default: i === index
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('docs_select')
            .setPlaceholder('Select a different result...')
            .addOptions(options);

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        return { embeds: [embed], components: [row] };
    };

    const message = await interaction.editReply(generateMessage(0));

    // Create Collector
    const collector = message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: i => i.user.id === interaction.user.id,
        time: 120000 // 2 minutes
    });

    collector.on('collect', async i => {
        const newIndex = parseInt(i.values[0]);
        await i.update(generateMessage(newIndex));
    });

    collector.on('end', () => {
        // Disable components on timeout
        interaction.editReply({ components: [] }).catch(() => {});
    });
}