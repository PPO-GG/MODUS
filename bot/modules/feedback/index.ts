import fs from "fs";
import path from "path";
import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { BotModule, ModuleManager } from "../../ModuleManager";
import {
  FEEDBACK_CATEGORIES,
  MESSAGE_MAX,
  MESSAGE_MIN,
  isFeedbackEnabled,
  postFeedbackWebhook,
  submitFeedback,
} from "./submit";

const MODULE = "feedback";
const ephemeral = [MessageFlags.Ephemeral] as const;

const feedbackCommand = new SlashCommandBuilder()
  .setName("feedback")
  .setDescription("Send feedback to the bot owner (Manage Server only)")
  .setDMPermission(false)
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((opt) =>
    opt
      .setName("category")
      .setDescription("What kind of feedback is it?")
      .setRequired(true)
      .addChoices(
        { name: "Bug", value: "bug" },
        { name: "Idea", value: "idea" },
        { name: "Other", value: "other" },
      ),
  )
  .addBooleanOption((opt) =>
    opt.setName("contact_ok").setDescription("May the bot owner contact you about this?"),
  )
  .toJSON();

/** Bot version for the feedback context; "unknown" when no package.json is found. */
function readBotVersion(): string {
  if (process.env.npm_package_version) return process.env.npm_package_version;
  for (const rel of ["../../package.json", "../../../package.json"]) {
    try {
      return JSON.parse(fs.readFileSync(path.join(__dirname, rel), "utf-8")).version;
    } catch {
      // try the next candidate
    }
  }
  return "unknown";
}

async function showModal(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "This command can only be used in a server.", flags: ephemeral });
    return;
  }
  // The default permission can be overridden in server settings, so check again here.
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: "You need the Manage Server permission to use this.", flags: ephemeral });
    return;
  }
  const category = interaction.options.getString("category", true);
  const contactOk = interaction.options.getBoolean("contact_ok") ?? false;
  const modal = new ModalBuilder()
    .setCustomId(`${MODULE}:submit:${category}:${contactOk ? "1" : "0"}`)
    .setTitle("Send feedback")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("message")
          .setLabel("Your feedback")
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(MESSAGE_MIN)
          .setMaxLength(MESSAGE_MAX)
          .setRequired(true),
      ),
    );
  await interaction.showModal(modal);
}

const errMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

async function handleSubmit(
  interaction: ModalSubmitInteraction,
  moduleManager: ModuleManager,
  category: string,
  contactOk: boolean,
): Promise<void> {
  await interaction.deferReply({ flags: ephemeral });
  try {
    const guild = interaction.guild;
    if (!guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.editReply("You need the Manage Server permission in a server to use this.");
      return;
    }
    const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
    const result = await submitFeedback(
      {
        feedback: moduleManager.databaseService.botFeedback,
        // Without a URL the row is still saved (D5); a thrown error is logged, URL-free.
        notify: async (row) => {
          if (!webhookUrl) throw new Error("FEEDBACK_WEBHOOK_URL is not set");
          await postFeedbackWebhook(webhookUrl, row);
        },
        now: () => new Date(),
        reportError: (stage, error) => {
          void moduleManager.logger
            .warn(`Feedback ${stage} failed: ${errMessage(error)}`, guild.id, MODULE)
            .catch(() => undefined);
        },
      },
      {
        guildId: guild.id,
        userId: interaction.user.id,
        category,
        message: interaction.fields.getTextInputValue("message"),
        contactOk,
        context: {
          v: 1,
          guildName: guild.name,
          memberCount: guild.memberCount ?? null,
          shardId: guild.shardId ?? null,
          botVersion: readBotVersion(),
          locale: interaction.locale ?? null,
        },
      },
    );

    if (result.ok) {
      await interaction.editReply("Thank you. Your feedback was sent to the bot owner.");
    } else if (result.reason === "rate_limited") {
      const minutes = Math.ceil(result.retryAfterMs / 60_000);
      await interaction.editReply(`You can send feedback once per hour. Try again in up to ${minutes} minutes.`);
    } else {
      await interaction.editReply(result.error);
    }
  } catch (err) {
    moduleManager.logger.error("Feedback submit failed", interaction.guildId ?? undefined, err, MODULE);
    await interaction.editReply("Something went wrong. Try again later.").catch(() => undefined);
  }
}

/**
 * Flag off (default): no commands, so /feedback is never registered with Discord.
 * No `meta`: the module is not on the per-server dashboard grid, so guilds cannot
 * turn it off (same as `reload`).
 */
export function createFeedbackModule(env: NodeJS.ProcessEnv): BotModule {
  const enabled = isFeedbackEnabled(env);
  return {
    name: MODULE,
    description: "Server admins send feedback to the bot owner",
    // The command must answer with a modal, so ModuleManager must not defer.
    skipDefer: true,
    commands: enabled ? [feedbackCommand] : [],
    execute: async (interaction: ChatInputCommandInteraction) => {
      if (interaction.commandName === "feedback") await showModal(interaction);
    },
    // customId format: feedback:submit:<category>:<1|0>
    handleModal: async (interaction: ModalSubmitInteraction, moduleManager: ModuleManager) => {
      if (!enabled) return;
      const [, action, category, contact] = interaction.customId.split(":");
      if (action !== "submit" || !category) return;
      await handleSubmit(interaction, moduleManager, category, contact === "1");
    },
    registerEvents: enabled
      ? (moduleManager) => {
          if (!env.FEEDBACK_WEBHOOK_URL) {
            moduleManager.logger.warn(
              "FEEDBACK_ENABLED is true but FEEDBACK_WEBHOOK_URL is not set: feedback is saved but not posted.",
              undefined,
              MODULE,
            );
          }
        }
      : undefined,
  };
}

export default createFeedbackModule(process.env);
