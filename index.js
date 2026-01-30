const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  Events
} = require("discord.js");

/* ================= CONFIG ================= */

const TOKEN = process.env.BOT_TOKEN;

const VERIFY_CHANNEL_NAME = "verify";
const LOG_CHANNEL_NAME = "mod-logs";

const ROLE_IDS = {
  VERIFIED: "1413856800033472535",
  AGE_13_17: "1413856800033472532",
  AGE_18_20: "1413856799638945880"
};

/* ========================================== */

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

/* ================= READY ================= */

client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if (!guild) return console.log("❌ No guild found");

  const verifyChannel = guild.channels.cache.find(
    c => c.name === VERIFY_CHANNEL_NAME
  );
  if (!verifyChannel) return console.log("❌ #verify channel not found");

  const embed = new EmbedBuilder()
    .setTitle("🔐 Age Verification Required")
    .setDescription(
      "**This server is restricted to users aged 13–20.**\n\n" +
      "Click the button below to verify your age.\n" +
      "Your birthdate is **not stored**.\n\n" +
      "_False information may result in removal._"
    )
    .setColor(0x5865F2)
    .setFooter({ text: "Verification System • Secure & Private" });

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("verify_age")
      .setLabel("Verify Age")
      .setEmoji("🪪")
      .setStyle(ButtonStyle.Primary)
  );

  await verifyChannel.send({ embeds: [embed], components: [buttonRow] });

  console.log("✅ Verification message sent");
});

/* ============ INTERACTIONS ============ */

client.on(Events.InteractionCreate, async interaction => {

  /* ---- Button Click ---- */
  if (interaction.isButton() && interaction.customId === "verify_age") {
    const modal = new ModalBuilder()
      .setCustomId("age_modal")
      .setTitle("Age Verification");

    const fields = [
      new TextInputBuilder()
        .setCustomId("day")
        .setLabel("Day (DD)")
        .setPlaceholder("e.g. 07")
        .setStyle(TextInputStyle.Short)
        .setRequired(true),

      new TextInputBuilder()
        .setCustomId("month")
        .setLabel("Month (MM)")
        .setPlaceholder("e.g. 11")
        .setStyle(TextInputStyle.Short)
        .setRequired(true),

      new TextInputBuilder()
        .setCustomId("year")
        .setLabel("Year (YYYY)")
        .setPlaceholder("e.g. 2008")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ];

    modal.addComponents(
      ...fields.map(f => new ActionRowBuilder().addComponents(f))
    );

    return interaction.showModal(modal);
  }

  /* ---- Modal Submit ---- */
  if (interaction.isModalSubmit() && interaction.customId === "age_modal") {
    const day = parseInt(interaction.fields.getTextInputValue("day"));
    const month = parseInt(interaction.fields.getTextInputValue("month")) - 1;
    const year = parseInt(interaction.fields.getTextInputValue("year"));

    if ([day, month, year].some(isNaN)) {
      return interaction.reply({
        content: "❌ Invalid date format.",
        ephemeral: true
      });
    }

    const dob = new Date(year, month, day);
    const today = new Date();

    let age = today.getFullYear() - dob.getFullYear();
    if (
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() &&
        today.getDate() < dob.getDate())
    ) {
      age--;
    }

    const member = interaction.member;
    const logChannel = interaction.guild.channels.cache.find(
      c => c.name === LOG_CHANNEL_NAME
    );

    /* ---- Age Check ---- */
    if (age < 13 || age > 20) {
      await interaction.reply({
        content: "❌ This server is restricted to ages **13–20**.",
        ephemeral: true
      });

      logChannel?.send(
        `🚫 **Verification Failed**\nUser: ${member.user.tag}\nReason: Age out of range`
      );

      setTimeout(() => member.kick("Age not allowed"), 3000);
      return;
    }

    /* ---- Role Assignment ---- */
    const verifiedRole = interaction.guild.roles.cache.get(
      ROLE_IDS.VERIFIED
    );

    const ageRole = interaction.guild.roles.cache.get(
      age >= 18 ? ROLE_IDS.AGE_18_20 : ROLE_IDS.AGE_13_17
    );

    if (!verifiedRole || !ageRole) {
      return interaction.reply({
        content: "❌ Verification failed. Please contact a moderator.",
        ephemeral: true
      });
    }

    await member.roles.add([verifiedRole, ageRole]);

    await interaction.reply({
      content: "✅ You are verified. Welcome!",
      ephemeral: true
    });

    logChannel?.send(
      `✅ **User Verified**\nUser: ${member.user.tag}\nAge Group: ${
        age >= 18 ? "18–20" : "13–17"
      }`
    );
  }
});

/* ============ LOGIN ============ */

client.login(TOKEN);
