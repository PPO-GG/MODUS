import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonInteraction,
  ChannelFlags,
  ChannelType,
  ChatInputCommandInteraction,
  Events,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadAutoArchiveDuration,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
} from "discord.js";
import type { APIInteractionGuildMember } from "discord.js";
import { BotModule, ModuleManager } from "../../ModuleManager";
import { buildSuggestionMessage, embedInputFromRow } from "./embed";
import { deployPanel } from "./deploy";
import { isChannelNotInGuild, isStaleInteractionError } from "./discord-errors";
import { resolveGuildSettings } from "./gate";
import { buildPanelMessage } from "./panel";
import { applyReview, type ReviewDeps } from "./review";
import { isStaff } from "./staff";
import { STAFF_STATUSES, STATUS_META, isStaffStatus } from "./status";
import { parseSuggestionsSettings } from "./settings";
import { submitSuggestion, type SubmitDeps } from "./submit";
import { isThreadOnlyType, pickRequiredTag, submitTarget } from "./target";
import { castVote } from "./vote";

const MODULE = "suggestions";
const TITLE_MAX = 100;
const BODY_MAX = 1500;
const REASON_MAX = 500;
/** Discord error code: Unknown Message. */
const UNKNOWN_MESSAGE = 10008;

const isUnknownMessage = (err: unknown) =>
  (err as { code?: number } | null)?.code === UNKNOWN_MESSAGE;

const errMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

const ephemeral = [MessageFlags.Ephemeral] as const;

const suggestCommand = new SlashCommandBuilder()
  .setName("suggest")
  .setDescription("Submit a suggestion for this server")
  .setDMPermission(false)
  .toJSON();

const suggestionCommand = new SlashCommandBuilder()
  .setName("suggestion")
  .setDescription("Manage suggestions")
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName("review")
      .setDescription("Set a suggestion's status (staff only)")
      .addIntegerOption((opt) =>
        opt
          .setName("number")
          .setDescription("The suggestion number")
          .setRequired(true)
          .setMinValue(1)
          .setAutocomplete(true),
      )
      .addStringOption((opt) =>
        opt
          .setName("status")
          .setDescription("The new status")
          .setRequired(true)
          .addChoices(...STAFF_STATUSES.map((s) => ({ name: STATUS_META[s].label, value: s }))),
      )
      .addStringOption((opt) =>
        opt
          .setName("reason")
          .setDescription("Shown on the suggestion")
          .setMaxLength(REASON_MAX),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("panel")
      .setDescription("Post or update the suggestions panel (staff only)")
      .addChannelOption((opt) =>
        opt
          .setName("channel")
          .setDescription("Channel to post the panel in")
          .setRequired(true)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
      ),
  )
  .toJSON();

function gateFor(moduleManager: ModuleManager, guildId: string) {
  const db = moduleManager.databaseService;
  return {
    isEnabled: () => db.isModuleEnabled(guildId, MODULE),
    loadSettings: () => db.getModuleSettings(guildId, MODULE),
  };
}

function memberRoleIds(member: GuildMember | APIInteractionGuildMember | null): string[] {
  if (!member) return [];
  return Array.isArray(member.roles) ? member.roles : [...member.roles.cache.keys()];
}

function isStaffMember(
  interaction: ChatInputCommandInteraction | AutocompleteInteraction,
  staffRoleIds: string[],
): boolean {
  return isStaff(
    {
      manageGuild: interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false,
      roleIds: memberRoleIds(interaction.member),
    },
    staffRoleIds,
  );
}

/**
 * Resolves a channel through the SOURCE guild only, so the bot can never touch
 * another server's channel even if a stored channel id points there. A channel
 * that does not belong to the guild resolves to null.
 */
async function guildChannel(guild: Guild, channelId: string) {
  const cached = guild.channels.cache.get(channelId);
  if (cached) return cached;
  try {
    return (await guild.channels.fetch(channelId)) ?? null;
  } catch (err) {
    // Only definite non-membership is "missing"; transient/permission errors propagate.
    if (isChannelNotInGuild(err)) return null;
    throw err;
  }
}

/** Sendable guild channel (messages-capable) or a thrown error. */
async function sendableGuildChannel(guild: Guild, channelId: string) {
  const channel = await guildChannel(guild, channelId);
  if (!channel || !channel.isSendable()) {
    throw new Error(`channel ${channelId} is missing or not sendable`);
  }
  return channel;
}

/**
 * Throws unless the bot has every permission in `required` in `channel`.
 * Without Embed Links Discord silently drops embeds, so this runs BEFORE posting
 * rather than letting a post "succeed" with only buttons.
 */
async function assertCanPost(guild: Guild, channel: GuildBasedChannel, required: bigint[]): Promise<void> {
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  const perms = me ? channel.permissionsFor(me) : null;
  if (!perms?.has(required)) {
    throw new Error(
      `missing permissions in channel ${channel.id} (needs View Channel, Send Messages, Embed Links${
        required.includes(PermissionFlagsBits.SendMessagesInThreads) ? ", Send Messages in Threads" : ""
      })`,
    );
  }
}

// ── /suggest ──────────────────────────────────────────────────────────

async function showSubmitModal(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  moduleManager: ModuleManager,
): Promise<void> {
  const gate = await resolveGuildSettings(gateFor(moduleManager, interaction.guildId!), {
    requireChannel: true,
  });
  if (!gate.ok) {
    await interaction.reply({ content: gate.message, flags: ephemeral });
    return;
  }

  const row = (input: TextInputBuilder) => new ActionRowBuilder<TextInputBuilder>().addComponents(input);
  const modal = new ModalBuilder()
    .setCustomId("suggestions:submit")
    .setTitle("Submit a suggestion")
    .addComponents(
      row(
        new TextInputBuilder()
          .setCustomId("title")
          .setLabel("Title")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(TITLE_MAX)
          .setRequired(true),
      ),
      row(
        new TextInputBuilder()
          .setCustomId("body")
          .setLabel("Details")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(BODY_MAX)
          .setRequired(true),
      ),
    );
  await interaction.showModal(modal);
}

async function submitFromModal(
  interaction: ModalSubmitInteraction,
  moduleManager: ModuleManager,
  guild: Guild,
): Promise<void> {
  const gate = await resolveGuildSettings(gateFor(moduleManager, guild.id), { requireChannel: true });
  if (!gate.ok) {
    await interaction.editReply(gate.message);
    return;
  }
  const { settings } = gate;
  const db = moduleManager.databaseService;

  const title = interaction.fields.getTextInputValue("title").trim();
  const body = interaction.fields.getTextInputValue("body").trim();
  if (!title || !body) {
    await interaction.editReply("Please enter both a title and details for your suggestion.");
    return;
  }

  const deps: SubmitDeps = {
    suggestions: db.suggestions,
    post: async (suggestion, payload) => {
      const channel = await guildChannel(guild, settings.channelId!);
      const target = submitTarget(channel?.type);
      if (!channel || !target) {
        throw new Error(
          `channel ${settings.channelId} is missing or is not a text, forum or media channel`,
        );
      }
      if (target === "forum") {
        if (channel.type !== ChannelType.GuildForum && channel.type !== ChannelType.GuildMedia) {
          throw new Error(`channel ${channel.id} is not a forum channel`);
        }
        await assertCanPost(guild, channel, [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.EmbedLinks,
        ]);
        // A forum that requires a tag rejects an untagged post (Discord 40067).
        let appliedTags: string[] | undefined;
        if (channel.flags.has(ChannelFlags.RequireTag)) {
          const tagId = pickRequiredTag(channel.availableTags);
          if (!tagId) {
            throw new Error(
              `forum channel ${channel.id} requires a tag but has no tag the bot can apply`,
            );
          }
          appliedTags = [tagId];
        }
        const thread = await channel.threads.create({
          name: `#${suggestion.number} ${suggestion.title}`.slice(0, 100),
          autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
          appliedTags,
          message: { ...payload, allowedMentions: { parse: [] } },
        });
        // A forum post IS its own thread, and its starter message shares the thread's id.
        return { channelId: thread.id, messageId: thread.id, threadId: thread.id };
      }
      if (!channel.isSendable()) throw new Error(`channel ${channel.id} is not sendable`);
      await assertCanPost(guild, channel, [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
      ]);
      const sent = await channel.send({ ...payload, allowedMentions: { parse: [] } });
      return { channelId: channel.id, messageId: sent.id };
    },
    deletePost: async (post) => {
      try {
        const channel = await guildChannel(guild, post.channelId);
        if (channel?.isThread() && isThreadOnlyType(channel.parent?.type)) {
          // Deleting only a forum post's starter message would leave a hollow thread.
          try {
            await channel.delete();
          } catch (err) {
            if (isUnknownMessage(err) || isChannelNotInGuild(err)) throw err;
            // No Manage Threads: at least remove the bot's own starter message.
            try {
              await channel.messages.delete(post.messageId);
            } catch (inner) {
              if (!isUnknownMessage(inner)) throw inner;
            }
          }
          return;
        }
        const sendable = await sendableGuildChannel(guild, post.channelId);
        await sendable.messages.delete(post.messageId);
      } catch (err) {
        // An already-gone message or post is the desired end state.
        if (!isUnknownMessage(err) && !isChannelNotInGuild(err)) throw err;
      }
    },
    createThread: async (suggestion, post) => {
      try {
        const channel = await guildChannel(guild, post.channelId);
        if (
          !channel ||
          (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)
        ) {
          throw new Error(`channel ${post.channelId} cannot host threads`);
        }
        // startMessage creates the thread from the post by id, so the bot does not
        // need Read Message History to fetch it first.
        const thread = await channel.threads.create({
          name: `#${suggestion.number} ${suggestion.title}`.slice(0, 100),
          startMessage: post.messageId,
          autoArchiveDuration: 1440,
        });
        return thread.id;
      } catch (err) {
        void moduleManager.logger.warn(
          `Could not create a suggestion thread: ${errMessage(err)}`,
          guild.id,
          MODULE,
        );
        return null;
      }
    },
    reportError: (stage, error) => {
      try {
        void moduleManager.logger
          .warn(`Suggestion submit (${stage}) failed: ${errMessage(error)}`, guild.id, MODULE)
          .catch(() => undefined);
      } catch {
        // The reporter must never throw.
      }
    },
  };

  const result = await submitSuggestion(deps, {
    guildId: guild.id,
    authorId: interaction.user.id,
    title,
    body,
    createThread: settings.createThread,
  });

  await interaction.editReply(
    result.ok
      ? `Your suggestion **#${result.suggestion.number}** was posted: ${result.messageUrl}`
      : result.error,
  );
}

async function handleSubmitModal(
  interaction: ModalSubmitInteraction,
  moduleManager: ModuleManager,
): Promise<void> {
  await interaction.deferReply({ flags: ephemeral });
  try {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply("This can only be used in a server.");
      return;
    }
    await submitFromModal(interaction, moduleManager, guild);
  } catch (err) {
    if (!isStaleInteractionError(err)) {
      moduleManager.logger.error(
        "Suggestion submit failed",
        interaction.guildId ?? undefined,
        err,
        MODULE,
      );
    }
    await interaction
      .editReply("Something went wrong submitting your suggestion.")
      .catch(() => undefined);
  }
}

// ── vote buttons ──────────────────────────────────────────────────────

async function handleVoteButton(
  interaction: ButtonInteraction,
  moduleManager: ModuleManager,
  suggestionId: string,
  direction: string,
): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId || (direction !== "up" && direction !== "down")) return;
  try {
    const gate = await resolveGuildSettings(gateFor(moduleManager, guildId), {
      requireChannel: false,
    });
    if (!gate.ok) {
      await interaction.reply({ content: gate.message, flags: ephemeral });
      return;
    }

    const db = moduleManager.databaseService;
    const outcome = await castVote(
      { suggestions: db.suggestions, votes: db.suggestionVotes },
      {
        suggestionId,
        userId: interaction.user.id,
        direction,
        closeVotingOnDecision: gate.settings.closeVotingOnDecision,
        guildId,
      },
    );

    if (outcome.kind === "reply") {
      await interaction.reply({ content: outcome.content, flags: ephemeral });
      return;
    }
    // The click's own response carries the new counts — no separate edit to rate-limit.
    await interaction.update(
      buildSuggestionMessage(
        embedInputFromRow(outcome.suggestion, outcome.tally, gate.settings.closeVotingOnDecision),
      ),
    );
  } catch (err) {
    if (!isStaleInteractionError(err)) {
      moduleManager.logger.error("Suggestion vote failed", guildId, err, MODULE);
    }
    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: "Something went wrong recording your vote.", flags: ephemeral })
        .catch(() => undefined);
    }
  }
}

// ── /suggestion review ────────────────────────────────────────────────

async function reviewFromCommand(
  interaction: ChatInputCommandInteraction,
  moduleManager: ModuleManager,
  guild: Guild,
): Promise<void> {
  const gate = await resolveGuildSettings(gateFor(moduleManager, guild.id), { requireChannel: false });
  if (!gate.ok) {
    await interaction.editReply(gate.message);
    return;
  }
  const { settings } = gate;

  const allowed = isStaffMember(interaction, settings.staffRoleIds);
  if (!allowed) {
    await interaction.editReply("Only staff can review suggestions.");
    return;
  }

  const number = interaction.options.getInteger("number", true);
  const status = interaction.options.getString("status", true);
  const reason = interaction.options.getString("reason")?.trim() || null;
  if (!isStaffStatus(status)) {
    await interaction.editReply("That isn't a status staff can set.");
    return;
  }

  const db = moduleManager.databaseService;
  const suggestion = await db.suggestions.getByNumber(guild.id, number);
  if (!suggestion) {
    await interaction.editReply(`There is no suggestion #${number}.`);
    return;
  }

  const deps: ReviewDeps = {
    suggestions: db.suggestions,
    votes: db.suggestionVotes,
    editMessage: async (row, payload) => {
      // No location yet means the submission is still in flight, not that the message is gone.
      if (!row.channelId || !row.messageId) throw new Error("suggestion has no posted message yet");
      const channel = await guildChannel(guild, row.channelId);
      if (!channel || !channel.isSendable()) return "missing";
      try {
        // A forum suggestion's embed is its thread's starter message, and Discord refuses
        // edits inside an archived thread. A locked thread stays a graceful failure.
        if (channel.isThread() && channel.archived && !channel.locked) {
          await channel.setArchived(false);
        }
        await channel.messages.edit(row.messageId, payload);
        return "ok";
      } catch (err) {
        if (isUnknownMessage(err)) return "missing";
        throw err;
      }
    },
    postThreadNote: async (row, content) => {
      if (!row.threadId) return;
      const thread = await guildChannel(guild, row.threadId);
      if (thread?.isSendable()) {
        await thread.send({ content, allowedMentions: { parse: [] } });
      }
    },
  };

  const result = await applyReview(deps, suggestion, {
    status,
    reason,
    reviewerId: interaction.user.id,
    closeVotingOnDecision: settings.closeVotingOnDecision,
  });

  if (!result.ok) {
    await interaction.editReply(`Suggestion #${number} was withdrawn and can't be reviewed.`);
    return;
  }
  if (result.withdrawn) {
    await interaction.editReply(
      `Suggestion #${number}'s message was deleted, so it was marked withdrawn.`,
    );
    return;
  }
  await interaction.editReply(
    `Marked #${number} as **${STATUS_META[status].label}**.` +
      (result.embedUpdated ? "" : " ⚠️ I couldn't update the suggestion message."),
  );
}

async function handleReview(
  interaction: ChatInputCommandInteraction,
  moduleManager: ModuleManager,
): Promise<void> {
  await interaction.deferReply({ flags: ephemeral });
  try {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply("This can only be used in a server.");
      return;
    }
    await reviewFromCommand(interaction, moduleManager, guild);
  } catch (err) {
    moduleManager.logger.error(
      "Suggestion review failed",
      interaction.guildId ?? undefined,
      err,
      MODULE,
    );
    await interaction
      .editReply("Something went wrong reviewing that suggestion.")
      .catch(() => undefined);
  }
}

async function handleAutocomplete(
  interaction: AutocompleteInteraction,
  moduleManager: ModuleManager,
): Promise<void> {
  try {
    if (!interaction.guildId) {
      await interaction.respond([]);
      return;
    }
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "number") {
      await interaction.respond([]);
      return;
    }
    // Titles are staff-only: require the module to be enabled in this guild and a staff member.
    const gate = await resolveGuildSettings(gateFor(moduleManager, interaction.guildId), {
      requireChannel: false,
    });
    if (!gate.ok) {
      await interaction.respond([]);
      return;
    }
    const allowed = isStaffMember(interaction, gate.settings.staffRoleIds);
    if (!allowed) {
      await interaction.respond([]);
      return;
    }
    const rows = await moduleManager.databaseService.suggestions.listForAutocomplete(
      interaction.guildId,
      String(focused.value),
      25,
    );
    await interaction.respond(
      rows.map((r) => ({ name: `#${r.number} ${r.title}`.slice(0, 100), value: r.number })),
    );
  } catch (err) {
    // 10062 from fast typing is routine; ModuleManager keeps it quiet too.
    if (!isStaleInteractionError(err)) {
      moduleManager.logger.error(
        "Suggestion autocomplete failed",
        interaction.guildId ?? undefined,
        err,
        MODULE,
      );
    }
    await interaction.respond([]).catch(() => undefined);
  }
}

// ── /suggestion panel ─────────────────────────────────────────────────

async function panelFromCommand(
  interaction: ChatInputCommandInteraction,
  moduleManager: ModuleManager,
  guild: Guild,
): Promise<void> {
  const gate = await resolveGuildSettings(gateFor(moduleManager, guild.id), { requireChannel: true });
  if (!gate.ok) {
    await interaction.editReply(gate.message);
    return;
  }
  const { settings } = gate;

  if (!isStaffMember(interaction, settings.staffRoleIds)) {
    await interaction.editReply("Only staff can post the suggestions panel.");
    return;
  }

  // Resolved through the interaction's own guild only.
  const picked = interaction.options.getChannel("channel", true);
  const channel = await guildChannel(guild, picked.id);
  if (
    !channel ||
    (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)
  ) {
    await interaction.editReply("Pick a text or announcement channel in this server.");
    return;
  }
  try {
    await assertCanPost(guild, channel, [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ]);
  } catch {
    await interaction.editReply(
      `I need View Channel, Send Messages and Embed Links in <#${channel.id}> to post the panel.`,
    );
    return;
  }

  // The gate above read through the bot's L1 cache, which can lag a dashboard save by up to
  // 60 s. Re-read straight from the repository (it throws instead of returning {}) so the panel
  // reflects the latest text and the merge below can never revert or wipe the stored config.
  const fresh = await moduleManager.databaseService.guildConfigs.getModuleSettings(guild.id, MODULE);
  const { settings: freshSettings } = parseSuggestionsSettings(fresh);

  const result = await deployPanel(
    {
      post: async (payload) => {
        const sent = await channel.send({ ...payload, allowedMentions: { parse: [] } });
        return sent.id;
      },
      edit: async (messageId, payload) => {
        try {
          await channel.messages.edit(messageId, payload);
          return "ok";
        } catch (err) {
          if (isUnknownMessage(err)) return "missing";
          throw err;
        }
      },
    },
    {
      channelId: channel.id,
      payload: buildPanelMessage(freshSettings),
      stored: { panelChannelId: freshSettings.panelChannelId, panelMessageId: freshSettings.panelMessageId },
    },
  );

  // setModuleSettings replaces the whole object, so merge into the fresh RAW stored settings.
  await moduleManager.databaseService.setModuleSettings(guild.id, MODULE, {
    ...fresh,
    panelChannelId: channel.id,
    panelMessageId: result.messageId,
  });

  await interaction.editReply(
    result.action === "updated"
      ? `✅ Updated the suggestions panel in <#${channel.id}>.`
      : result.action === "reposted"
        ? `✅ The old panel message was gone, so I posted a new one in <#${channel.id}>.`
        : `✅ Posted the suggestions panel in <#${channel.id}>.`,
  );
}

async function handlePanel(
  interaction: ChatInputCommandInteraction,
  moduleManager: ModuleManager,
): Promise<void> {
  await interaction.deferReply({ flags: ephemeral });
  try {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply("This can only be used in a server.");
      return;
    }
    await panelFromCommand(interaction, moduleManager, guild);
  } catch (err) {
    moduleManager.logger.error(
      "Suggestions panel deploy failed",
      interaction.guildId ?? undefined,
      err,
      MODULE,
    );
    await interaction
      .editReply("Something went wrong posting the panel. Check my permissions in that channel.")
      .catch(() => undefined);
  }
}

// ── events ────────────────────────────────────────────────────────────

function registerSuggestionsEvents(moduleManager: ModuleManager): void {
  const { client, logger, databaseService: db } = moduleManager;

  // A deleted suggestion message or channel withdraws the suggestion (the row is kept).
  client.on(Events.MessageDelete, async (message) => {
    try {
      if (!message.guildId) return;
      await db.suggestions.markWithdrawnByMessage(message.guildId, message.id);
    } catch (err) {
      logger.error("Suggestions message-delete handler failed", message.guildId ?? undefined, err, MODULE);
    }
  });

  // Purging a channel emits only MessageBulkDelete, never per-message MessageDelete.
  client.on(Events.MessageBulkDelete, async (messages, channel) => {
    const guildId = channel.guildId;
    if (!guildId) return;
    try {
      await db.suggestions.markWithdrawnByMessages(guildId, [...messages.keys()]);
    } catch (err) {
      logger.error("Suggestions bulk-delete handler failed", guildId, err, MODULE);
    }
  });

  client.on(Events.ChannelDelete, async (channel) => {
    if (channel.isDMBased()) return;
    const guildId = channel.guildId;
    try {
      await db.suggestions.markWithdrawnByChannel(guildId, channel.id);
    } catch (err) {
      logger.error("Suggestions channel-delete handler failed", guildId, err, MODULE);
    }
  });

  // A forum suggestion IS its thread: deleting the post emits ThreadDelete (not ChannelDelete).
  client.on(Events.ThreadDelete, async (thread) => {
    try {
      await db.suggestions.markWithdrawnByChannel(thread.guildId, thread.id);
    } catch (err) {
      logger.error("Suggestions thread-delete handler failed", thread.guildId, err, MODULE);
    }
  });

  logger.info("Suggestions events registered.", undefined, MODULE);
}

const suggestionsModule: BotModule = {
  name: MODULE,
  description: "Members submit suggestions (/suggest or a panel button) that the community votes on and staff review",
  // /suggest must answer with a modal (the initial reply), so ModuleManager must not defer.
  skipDefer: true,
  commands: [suggestCommand, suggestionCommand],
  meta: {
    displayName: "Suggestions",
    category: "community",
    icon: "i-lucide-lightbulb",
    color: "emerald",
    tags: ["suggestions", "feedback", "voting", "ideas", "review"],
  },

  execute: async (interaction: ChatInputCommandInteraction, moduleManager: ModuleManager) => {
    if (!interaction.guildId) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: ephemeral });
      return;
    }
    if (interaction.commandName === "suggest") return showSubmitModal(interaction, moduleManager);
    if (interaction.commandName === "suggestion") {
      const sub = interaction.options.getSubcommand();
      if (sub === "review") return handleReview(interaction, moduleManager);
      if (sub === "panel") return handlePanel(interaction, moduleManager);
    }
  },

  autocomplete: handleAutocomplete,

  // customId format: suggestions:vote:<suggestionId>:up|down, or suggestions:new (the panel button)
  handleButton: async (interaction: ButtonInteraction, moduleManager: ModuleManager) => {
    const [, action, id, direction] = interaction.customId.split(":");
    if (action === "new") return showSubmitModal(interaction, moduleManager);
    if (action === "vote" && id) return handleVoteButton(interaction, moduleManager, id, direction ?? "");
  },

  // customId format: suggestions:submit
  handleModal: async (interaction: ModalSubmitInteraction, moduleManager: ModuleManager) => {
    const [, action] = interaction.customId.split(":");
    if (action === "submit") return handleSubmitModal(interaction, moduleManager);
  },

  registerEvents: registerSuggestionsEvents,
};

export default suggestionsModule;
