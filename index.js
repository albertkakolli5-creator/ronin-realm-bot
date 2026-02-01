import { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionsBitField } from "discord.js";
import dotenv from "dotenv";
import http from "http";
dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const commands = [
  new SlashCommandBuilder()
    .setName("begruessung")
    .setDescription("Setzt den Begrüßungs-Channel")
    .addChannelOption(option =>
      option.setName("channel")
        .setDescription("Channel für Begrüßungen")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kickt ein Mitglied")
    .addUserOption(option => option.setName("user").setDescription("Zu kickendes Mitglied").setRequired(true))
    .addStringOption(option => option.setName("grund").setDescription("Grund").setRequired(false)),
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannt ein Mitglied")
    .addUserOption(option => option.setName("user").setDescription("Zu bannendes Mitglied").setRequired(true))
    .addStringOption(option => option.setName("grund").setDescription("Grund").setRequired(false)),
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Löscht Nachrichten")
    .addIntegerOption(option => option.setName("anzahl").setDescription("Anzahl").setRequired(true))
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function registerCommands() {
  try {
    console.log("Registering commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("Commands registered.");
  } catch (error) {
    console.error(error);
  }
}

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
  registerCommands();
});

const welcomeSettings = new Map(); // {guildId => channelId}

client.on("guildMemberAdd", async (member) => {
  const channelId = welcomeSettings.get(member.guild.id);
  if (!channelId) return;

  const channel = member.guild.channels.cache.get(channelId);
  if (!channel) return;

  channel.send({
    content: `Willkommen in **Ronin Realm | 浪人界**, <@${member.id}>! 🥷\n\nBitte lies die Regeln und stell dich kurz vor.`
  });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "begruessung") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: "Du brauchst Admin-Rechte.", ephemeral: true });
    }
    const channel = interaction.options.getChannel("channel");
    welcomeSettings.set(interaction.guild.id, channel.id);
    return interaction.reply({ content: `Begrüßungs-Channel wurde gesetzt: ${channel}`, ephemeral: true });
  }

  if (commandName === "kick") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({ content: "Du brauchst die Rechte: Kick Members.", ephemeral: true });
    }

    const user = interaction.options.getUser("user");
    const grund = interaction.options.getString("grund") || "Kein Grund angegeben";

    const member = interaction.guild.members.cache.get(user.id);
    if (!member) return interaction.reply({ content: "Mitglied nicht gefunden.", ephemeral: true });

    await member.kick(grund);
    return interaction.reply({ content: `**${user.tag}** wurde gekickt.\nGrund: ${grund}` });
  }

  if (commandName === "ban") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: "Du brauchst die Rechte: Ban Members.", ephemeral: true });
    }

    const user = interaction.options.getUser("user");
    const grund = interaction.options.getString("grund") || "Kein Grund angegeben";

    const member = interaction.guild.members.cache.get(user.id);
    if (!member) return interaction.reply({ content: "Mitglied nicht gefunden.", ephemeral: true });

    await member.ban({ reason: grund });
    return interaction.reply({ content: `**${user.tag}** wurde gebannt.\nGrund: ${grund}` });
  }

  if (commandName === "clear") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({ content: "Du brauchst die Rechte: Nachrichten verwalten.", ephemeral: true });
    }

    const anzahl = interaction.options.getInteger("anzahl");
    if (anzahl < 1 || anzahl > 100) {
      return interaction.reply({ content: "Bitte eine Zahl zwischen 1 und 100.", ephemeral: true });
    }

    await interaction.channel.bulkDelete(anzahl, true);
    return interaction.reply({ content: `🔧 ${anzahl} Nachrichten gelöscht.`, ephemeral: true });
  }
});

client.login(process.env.TOKEN);

// Minimaler HTTP-Healthcheck für Plattformen, die einen `web`-Prozess erwarten.
// Startet nur, wenn `PORT` gesetzt ist (z.B. durch Railpack/Hosting).
const port = process.env.PORT;
if (port) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK\n");
  });

  server.listen(port, () => {
    console.log(`Health server listening on port ${port}`);
  });
}
