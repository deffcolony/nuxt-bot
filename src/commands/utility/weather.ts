import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    Client,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    StringSelectMenuBuilder,
    Interaction,
    Message,
} from 'discord.js';
import { URLSearchParams } from 'url';

// --- TYPE INTERFACES FOR APIS ---

// For wttr.in (Current Weather)
interface WttrInData {
    current_condition: {
        FeelsLikeC: string;
        FeelsLikeF: string;
        temp_C: string;
        temp_F: string;
        humidity: string;
        weatherDesc: { value: string }[];
        windspeedKmph: string;
        windspeedMiles: string;
        uvIndex: string;
        visibility: string; 
    }[];
    nearest_area: {
        areaName: { value: string }[];
        country: { value: string }[];
    }[];
}

// For OpenStreetMap Nominatim (Geocoding)
interface GeocodeData {
    lat: string;
    lon: string;
    display_name: string;
}

// For Open-Meteo (7-Day Forecast)
interface ForecastData {
    daily: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
    };
    daily_units: {
        temperature_2m_max: string;
    }
}

// --- COMMAND DEFINITION ---

export const data = new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Fetches the current weather with interactive components and forecasts.')
    .addStringOption(option =>
        option.setName('location')
            .setDescription('The city or area to get the weather for (e.g., London, "New York", 90210)')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('units')
            .setDescription('The unit system to use (Defaults to metric).')
            .setRequired(false)
            .addChoices(
                { name: 'Metric (°C, km/h)', value: 'm' },
                { name: 'Imperial (°F, mph)', value: 'u' }
            ));


type View = 'standard' | 'detailed' | 'forecast';
type Units = 'm' | 'u';

// --- MESSAGE GENERATION LOGIC ---

// Main function to generate the correct message payload based on the selected view
async function generateWeatherMessage(location: string, units: Units, view: View) {
    if (view === 'forecast') {
        return generateForecastMessage(location, units);
    }
    return generateCurrentWeatherMessage(location, units, view);
}


// Generates the embed and components for the 7-day forecast view
async function generateForecastMessage(location: string, units: Units) {
    // 1. Geocode location string to lat/lon
    const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`);
    if (!geoResponse.ok) throw new Error('Failed to geocode location.');
    const geoData = (await geoResponse.json()) as GeocodeData[];
    if (!geoData || geoData.length === 0) throw new Error(`Could not find coordinates for "${location}".`);
    
    const { lat, lon, display_name } = geoData[0];

    // 2. Fetch 7-day forecast from Open-Meteo
    const tempUnit = units === 'u' ? 'fahrenheit' : 'celsius';
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min&timezone=auto&temperature_unit=${tempUnit}`;
    const forecastResponse = await fetch(forecastUrl);
    if (!forecastResponse.ok) throw new Error('Failed to fetch forecast data.');
    const forecast = (await forecastResponse.json()) as ForecastData;

    // 3. Generate chart using QuickChart.io
    const chartConfig = {
        type: 'line',
        data: {
            labels: forecast.daily.time.map(date => new Date(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })),
            datasets: [
                {
                    label: `Max Temp (${forecast.daily_units.temperature_2m_max})`,
                    data: forecast.daily.temperature_2m_max,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: false,
                    yAxisID: 'y'
                },
                {
                    label: `Min Temp (${forecast.daily_units.temperature_2m_max})`,
                    data: forecast.daily.temperature_2m_min,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: false,
                    yAxisID: 'y'
                },
            ],
        },
        options: {
            title: { display: true, text: '7-Day Temperature Forecast' },
            scales: { yAxes: [{ id: 'y', ticks: { beginAtZero: false } }] }
        },
    };
    
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&backgroundColor=white&width=500&height=300`;

    const embed = new EmbedBuilder()
        .setTitle(`7-Day Forecast for ${display_name.split(',')[0]}`)
        .setDescription('Highs and lows for the upcoming week.')
        .setColor(0x5865F2)
        .setImage(chartUrl)
        .setFooter({ text: 'Forecast data from Open-Meteo. Geocoding by OpenStreetMap.' })
        .setTimestamp();

    const components = createComponents(units, 'forecast');
    return { embeds: [embed], components };
}


// Generates the embed and components for the current weather (standard/detailed)
async function generateCurrentWeatherMessage(location: string, units: Units, view: 'standard' | 'detailed') {
    const response = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
    if (!response.ok) throw new Error(`Could not find weather data for "${location}".`);

    const weather = (await response.json()) as WttrInData;
    if (!weather.current_condition) throw new Error(`Invalid data for "${location}".`);

    const current = weather.current_condition[0];
    const area = weather.nearest_area[0];

    const temp = units === 'u' ? `${current.temp_F}°F` : `${current.temp_C}°C`;
    const feelsLike = units === 'u' ? `${current.FeelsLikeF}°F` : `${current.FeelsLikeC}°C`;
    const windSpeed = units === 'u' ? `${current.windspeedMiles} mph` : `${current.windspeedKmph} km/h`;
    const visibility = units === 'u' ? `${(parseInt(current.visibility) * 0.621371).toFixed(1)} miles` : `${current.visibility} km`;
    const weatherDescription = current.weatherDesc[0].value;
    const weatherEmoji = getWeatherEmoji(weatherDescription);

    const embed = new EmbedBuilder()
        .setTitle(`Weather for ${area.areaName[0].value}, ${area.country[0].value}`)
        .setDescription(`${weatherEmoji} **${weatherDescription}**`)
        .setColor(0x5865F2)
        .setFooter({ text: 'Powered by wttr.in' })
        .setTimestamp();
    
    if (view === 'standard') {
        embed.addFields(
            { name: '🌡️ Temperature', value: `${temp} (Feels like ${feelsLike})`, inline: true },
            { name: '💧 Humidity', value: `${current.humidity}%`, inline: true },
            { name: '💨 Wind', value: windSpeed, inline: true },
        );
    } else { // detailed view
        embed.addFields(
            { name: '🌡️ Temperature', value: temp, inline: true },
            { name: '🌡️ Feels Like', value: feelsLike, inline: true },
            { name: '💧 Humidity', value: `${current.humidity}%`, inline: true },
            { name: '💨 Wind Speed', value: windSpeed, inline: true },
            { name: '👁️ Visibility', value: visibility, inline: true },
            { name: '☀️ UV Index', value: current.uvIndex, inline: true },
        );
    }
    
    const components = createComponents(units, view);
    return { embeds: [embed], components };
}

// Helper to create the interactive components (buttons and select menu)
function createComponents(units: Units, currentView: View) {
    const buttonsRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('weather_refresh')
                .setLabel('Refresh')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄'),
            new ButtonBuilder()
                .setCustomId('weather_switch_units')
                .setLabel(`Switch to ${units === 'm' ? 'Imperial' : 'Metric'}`)
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('weather_delete')
                .setLabel('Delete')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🗑️')
        );

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('weather_view_select')
                .setPlaceholder('Select a different view...')
                .addOptions(
                    { label: 'Standard View', description: 'The default, compact weather view.', value: 'standard', default: currentView === 'standard' },
                    { label: 'Detailed View', description: 'Shows more data like UV index and visibility.', value: 'detailed', default: currentView === 'detailed' },
                    { label: '7-Day Forecast', description: 'Shows a graph of the upcoming week\'s temperatures.', value: 'forecast', default: currentView === 'forecast' }
                )
        );

    return [selectRow, buttonsRow];
}


// --- COMMAND EXECUTION ---

export async function execute(client: Client, interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    let location = interaction.options.getString('location', true);
    let units = (interaction.options.getString('units') ?? 'm') as Units;
    let currentView: View = 'standard';

    try {
        const messagePayload = await generateWeatherMessage(location, units, currentView);
        const message = await interaction.editReply(messagePayload);

        const collector = message.createMessageComponentCollector({
            filter: (i: Interaction) => i.user.id === interaction.user.id,
            time: 5 * 60 * 1000, 
        });

        collector.on('collect', async i => {
            // Acknowledge the interaction to prevent "interaction failed" error
            await i.deferUpdate();
            
            try {
                if (i.isButton()) {
                    if (i.customId === 'weather_refresh') {
                        const newPayload = await generateWeatherMessage(location, units, currentView);
                        await i.editReply(newPayload);
                    } else if (i.customId === 'weather_switch_units') {
                        units = units === 'm' ? 'u' : 'm';
                        const newPayload = await generateWeatherMessage(location, units, currentView);
                        await i.editReply(newPayload);
                    } else if (i.customId === 'weather_delete') {
                        await interaction.deleteReply();
                        collector.stop();
                        return;
                    }
                } else if (i.isStringSelectMenu()) {
                    if (i.customId === 'weather_view_select') {
                        currentView = i.values[0] as View;
                        if (currentView === 'forecast') {
                            await i.editReply({ content: '📈 Generating forecast graph...', embeds: [], components: [] });
                        }
                        const newPayload = await generateWeatherMessage(location, units, currentView);
                        await i.editReply(newPayload);
                    }
                }
            } catch (error) {
                 console.error('Interaction failed:', error);
                 await i.editReply({ 
                     content: `❌ Sorry, an error occurred while updating the view: ${error.message}`,
                     embeds: [], components: [] 
                 });
            }
        });

        collector.on('end', async () => {
            try {
                const messageExists = await interaction.channel?.messages.fetch(message.id).catch(() => null);
                if (!messageExists) return;

                const finalPayload = await generateWeatherMessage(location, units, currentView);
                finalPayload.components.forEach(row => row.components.forEach(c => c.setDisabled(true)));
                await message.edit(finalPayload);
            } catch (error) {
                console.error("Failed to edit message after collector timeout:", error);
            }
        });

    } catch (error) {
        console.error('Weather command failed:', error);
        await interaction.editReply({ 
            content: `❌ Sorry, I couldn't fetch the weather. Please check the location. \n\`${error.message}\``,
            embeds: [], components: [],
        });
    }
}

function getWeatherEmoji(description: string): string {
    const desc = description.toLowerCase();
    if (desc.includes('sunny') || desc.includes('clear')) return '☀️';
    if (desc.includes('partly cloudy')) return '⛅';
    if (desc.includes('cloudy') || desc.includes('overcast')) return '☁️';
    if (desc.includes('mist') || desc.includes('fog')) return '🌫️';
    if (desc.includes('rain') || desc.includes('drizzle')) return '🌧️';
    if (desc.includes('thundery')) return '⛈️';
    if (desc.includes('snow') || desc.includes('sleet') || desc.includes('blizzard')) return '❄️';
    return '🌍';
}