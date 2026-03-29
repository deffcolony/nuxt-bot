import dotenv from 'dotenv';
import { Client, IntentsBitField, Partials } from 'discord.js';
import eventHandler from './handlers/eventHandler';
import { syncDocs } from './utils/docManager';


dotenv.config();

const client: Client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessageReactions
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.User
  ],
});





(async () => {
  try {
    eventHandler(client);
    
    // Start syncing docs in the background
    syncDocs().catch(err => console.error("Docs sync failed:", err));

    await client.login(process.env.TOKEN!);
  } catch (error) {
    console.error(`Error: ${error}`);
  }
})();

