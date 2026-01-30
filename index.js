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
  Events,
  PermissionFlagsBits
} = require("discord.js");

/* ================= CONFIG ================= */

const TOKEN = process.env.BOT_TOKEN;

const VERIFY_CHANNEL_NAME = "verify";
const LOG_CHANNEL_NAME = "mod-logs";

// ✅ PROVIDED ROLE IDS
const VERIFIED_ROLE_ID = "1402968064248778805";
const AGE_13_17_ROLE_ID = "1466828437225341029";
const AGE_18_20_ROLE_ID = "1466828536374366260";

/* ========================================== */

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

/* ================= UTIL ================= */

function sendModLog(channel, title, description, color = 0x2f3136) {
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  channel.send({ embeds: [embed] });
}

/* ================= READY ================= */

client.once("ready", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    try {
      const verifyChannel = guild.channels.cache.find(
        c => c.name === VERIFY_CHANNEL_NAME
      );
      if (!verifyChannel) continue;

      const messages = await verifyChannel.messages.fetch({ limit: 10 });
      const exists = messages.some(
        m => m.author.id === client.user.id && m.components.length > 0
      );

      if (exists) continue;

      const embed = new EmbedBuilder()
        .setTitle("🛂 Server Age Verification")
        .setDescription(
          "**Welcome to the community.**\n\n" +
          "Before continuing, please verify your age.\n\n" +
          "• Allowed age range: **13–20**\n" +
          "• Takes less than **10 seconds**\n" +
          "• Your birthdate is **never stored**\n\n" +
          "_False information may result in removal._"
        )
        .setColor(0x5865f2)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .setFooter({
          text: "Secure Verification • Privacy First"
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("verify_age")
          .setLabel("Verify My Age")
          .setStyle(ButtonStyle.Primary)
      );

      await verifyChannel.send({ embeds: [embed], components: [row] });
      console.log(`✅ Verification message posted in ${guild.name}`);
    } catch (err) {
      console.error(`❌ Error in ${guild.name}`, err);
    }
  }
});

/* ============ INTERACTIONS ============ */

client.on(Events.InteractionCreate, async interaction => {

  /* ---------- BUTTON ---------- */
  if (interaction.isButton() && interaction.customId === "verify_age") {
    const member = interaction.member;

    // 🛑 Already verified guard
    if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
      return interaction.reply({
        content: "✅ You are already verified.",
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("age_modal")
      .setTitle("Age Verification");

    const day = new TextInputBuilder()
      .setCustomId("day")
      .setLabel("Day (DD)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const month = new TextInputBuilder()
      .setCustomId("month")
      .setLabel("Month (MM)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const year = new TextInputBuilder()
      .setCustomId("year")
      .setLabel("Year (YYYY)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(day),
      new ActionRowBuilder().addComponents(month),
      new ActionRowBuilder().addComponents(year)
    );

    return interaction.showModal(modal);
  }

  /* ---------- MODAL ---------- */
  if (interaction.isModalSubmit() && interaction.customId === "age_modal") {
    const member = interaction.member;
    const guild = interaction.guild;
    const logChannel = guild.channels.cache.find(
      c => c.name === LOG_CHANNEL_NAME
    );

    // 🛑 Double guard
    if (member.roles.cache.has(VERIFIED_ROLE_ID)) {
      return interaction.reply({
        content: "✅ You are already verified.",
        ephemeral: true
      });
    }

    const d = parseInt(interaction.fields.getTextInputValue("day"));
    const m = parseInt(interaction.fields.getTextInputValue("month")) - 1;
    const y = parseInt(interaction.fields.getTextInputValue("year"));

    if ([d, m, y].some(isNaN)) {
      return interaction.reply({
        content: "❌ Invalid date format.",
        ephemeral: true
      });
    }

    const dob = new Date(y, m, d);
    const today = new Date();

    let age = today.getFullYear() - dob.getFullYear();
    if (
      today.getMonth() < dob.getMonth() ||
      (today.getMonth() === dob.getMonth() &&
        today.getDate() < dob.getDate())
    ) {
      age--;
    }

    /* ---------- AGE FAIL ---------- */
    if (age < 13 || age > 20) {
      await interaction.reply({
        content: "❌ This server is restricted to users aged **13–20**.",
        ephemeral: true
      });

      sendModLog(
        logChannel,
        "🚫 Verification Failed",
        `**User:** ${member.user.tag}\n**Reason:** Age out of range`,
        0xed4245
      );

      if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
        setTimeout(async () => {
          try {
            await member.kick("Age not allowed");
          } catch {
            sendModLog(
              logChannel,
              "⚠️ Kick Failed",
              `**User:** ${member.user.tag}\n**Reason:** Role hierarchy or permissions`,
              0xfaa61a
            );
          }
        }, 3000);
      }

      return;
    }

    /* ---------- SUCCESS ---------- */
    const verifiedRole = guild.roles.cache.get(VERIFIED_ROLE_ID);
    const ageRole = guild.roles.cache.get(
      age >= 18 ? AGE_18_20_ROLE_ID : AGE_13_17_ROLE_ID
    );

    await member.roles.add([verifiedRole, ageRole]);

    await interaction.reply({
      content: "✅ **Verification successful. Welcome!**",
      ephemeral: true
    });

    sendModLog(
      logChannel,
      "✅ User Verified",
      `**User:** ${member.user.tag}\n**Age Group:** ${
        age >= 18 ? "18–20" : "13–17"
      }`,
      0x57f287
    );

    // 🔒 Disable button after success
    try {
      const message = await interaction.channel.messages.fetch(
        interaction.message.id
      );

      const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(message.components[0].components[0]).setDisabled(true)
      );

      await message.edit({ components: [disabledRow] });
    } catch {
      /* Silent fail – not critical */
    }
  }
});

/* ============ LOGIN ============ */

client.login(TOKEN);
