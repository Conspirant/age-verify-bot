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

// 🔴 REPLACE THESE WITH YOUR REAL ROLE IDS
const VERIFIED_ROLE_ID = "1413856800033472535";
const AGE_13_17_ROLE_ID = "1413856800033472532";
const AGE_18_20_ROLE_ID = "1413856799638945880";

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

  // 🔒 Prevent duplicate verification messages
  const recentMessages = await verifyChannel.messages.fetch({ limit: 10 });
  const alreadyExists = recentMessages.some(
    m => m.author.id === client.user.id && m.components.length > 0
  );

  if (alreadyExists) {
    console.log("ℹ️ Verification message already exists");
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle("🔐 Age Verification Required")
    .setDescription(
      "**This server is restricted to users aged 13–20.**\n\n" +
      "Click the button below to verify your age.\n" +
      "Your birthdate is **not stored**.\n\n" +
      "_False information may result in removal._"
    )
    .setColor(0x5865f2)
    .setFooter({ text: "Verification System • Secure & Private" });

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("verify_age")
      .setLabel("Verify Age")
      .setEmoji("🪪")
      .setStyle(ButtonStyle.Primary)
  );

  await verifyChannel.send({
    embeds: [embed],
    components: [buttonRow]
  });

  console.log("✅ Verification message sent");
});

/* ============ INTERACTIONS ============ */

client.on(Events.InteractionCreate, async interaction => {

  /* ---------- BUTTON CLICK ---------- */
  if (interaction.isButton() && interaction.customId === "verify_age") {
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

  /* ---------- MODAL SUBMIT ---------- */
  if (interaction.isModalSubmit() && interaction.customId === "age_modal") {
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

    const member = interaction.member;
    const logChannel = interaction.guild.channels.cache.find(
      c => c.name === LOG_CHANNEL_NAME
    );

    /* ---------- AGE CHECK ---------- */
    if (age < 13 || age > 20) {
      await interaction.reply({
        content: "❌ This server is restricted to ages **13–20**.",
        ephemeral: true
      });

      logChannel?.send(
        `🚫 **Verification Failed**\nUser: ${member.user.tag}\nReason: Age out of range`
      );

      // 🚨 DO NOT TRY TO KICK ADMINS
      if (member.permissions.has(PermissionFlagsBits.Administrator)) {
        logChannel?.send(
          `⚠️ ${member.user.tag} is an admin — not kicked`
        );
        return;
      }

      // 🛡️ Safe kick (won’t crash bot)
      setTimeout(async () => {
        try {
          await member.kick("Age not allowed");
        } catch (err) {
          logChannel?.send(
            `⚠️ Failed to kick ${member.user.tag} (role hierarchy or permissions)`
          );
        }
      }, 3000);

      return;
    }

    /* ---------- ROLE ASSIGNMENT ---------- */
    const verifiedRole = interaction.guild.roles.cache.get(
      VERIFIED_ROLE_ID
    );

    const ageRole = interaction.guild.roles.cache.get(
      age >= 18 ? AGE_18_20_ROLE_ID : AGE_13_17_ROLE_ID
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
