import {
  ChannelType,
  Events,
  PermissionFlagsBits,
  type Channel,
  type Guild,
  type Message,
  type MessageReaction,
  type PartialMessage,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from "discord.js";
import { BotModule, ModuleManager } from "../../ModuleManager";
import type { StarboardBoard } from "../../lib/schemas";
import { boardMatchesEmoji, emojiKey, parseStarboard } from "./boards";
import { countReactors } from "./count";
import { isEligibleChannel, isLeakToPublicBoard } from "./evaluate";
import { buildBoardMessage } from "./post";
import { processBoard, type ProcessDeps } from "./process";
import { KeyedCoalescer } from "./queue";
import { LogThrottle } from "./throttle";

const MODULE = "starboard";
/** Edits to one board post are spaced at least this far apart; the final count wins. */
const EDIT_MIN_INTERVAL_MS = 3000;
const WARN_TTL_MS = 60 * 60_000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60_000;
/** Give the gateway time to populate the guild cache before the first cleanup. */
const FIRST_CLEANUP_DELAY_MS = 5 * 60_000;
/** Discord error code: Unknown Message. */
const UNKNOWN_MESSAGE = 10008;

const coalescer = new KeyedCoalescer({ minIntervalMs: EDIT_MIN_INTERVAL_MS });
const warnThrottle = new LogThrottle(WARN_TTL_MS);

const isCustomEmojiId = (emoji: string) => /^\d{15,25}$/.test(emoji);

/** Parsed boards for a guild. With `requireEnabled`, returns [] when the module is off for the guild. */
async function loadBoards(
  moduleManager: ModuleManager,
  guildId: string,
  requireEnabled: boolean,
): Promise<StarboardBoard[]> {
  const db = moduleManager.databaseService;
  if (requireEnabled && !(await db.isModuleEnabled(guildId, MODULE))) return [];
  const settings = await db.getModuleSettings(guildId, MODULE);
  const parsed = parseStarboard(settings);
  return requireEnabled ? parsed.boards.filter((b) => b.enabled) : parsed.boards;
}

/**
 * Resolves the board channel through the SOURCE guild only, so a board can
 * never post into another server even if its stored channel id points there.
 */
async function resolveBoardChannel(guild: Guild, board: StarboardBoard) {
  const channel =
    guild.channels.cache.get(board.channelId) ??
    (await guild.channels.fetch(board.channelId).catch(() => null));
  return channel ?? null;
}

async function boardChannel(guild: Guild, board: StarboardBoard) {
  const channel = await resolveBoardChannel(guild, board);
  if (!channel || !channel.isSendable()) {
    throw new Error(`board channel ${board.channelId} is missing or not sendable`);
  }
  return channel;
}

/**
 * Whether @everyone can see the channel. Threads inherit from their parent
 * (private threads are never public); an unresolved channel counts as not viewable.
 */
function viewableByEveryone(guild: Guild, channel: Channel | null): boolean {
  if (!channel || channel.type === ChannelType.PrivateThread) return false;
  const base = channel.isThread() ? channel.parent : channel;
  if (!base || !("permissionsFor" in base)) return false;
  return base.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel) ?? false;
}

function isUnknownMessage(err: unknown): boolean {
  return (err as { code?: number } | null)?.code === UNKNOWN_MESSAGE;
}

function warnOnce(moduleManager: ModuleManager, guildId: string, board: StarboardBoard, err: unknown) {
  if (!warnThrottle.shouldLog(`${board.id}`)) return;
  void moduleManager.logger.warn(
    `Starboard "${board.name}" could not update its board channel: ${
      err instanceof Error ? err.message : String(err)
    }`,
    guildId,
    MODULE,
  );
}

function payloadFor(
  message: Message,
  board: StarboardBoard,
  count: number,
  reaction: MessageReaction,
) {
  return buildBoardMessage({
    guildId: message.guildId!,
    channelId: message.channelId,
    messageId: message.id,
    authorName: message.member?.displayName ?? message.author.username,
    authorAvatarUrl: (message.member ?? message.author).displayAvatarURL(),
    content: message.content,
    attachments: [...message.attachments.values()].map((a) => ({
      url: a.url,
      name: a.name,
      contentType: a.contentType,
      spoiler: a.spoiler,
    })),
    createdAtMs: message.createdTimestamp,
    count,
    // Unicode boards show their configured glyph; custom boards show the live
    // emoji of the reaction being processed (renders even when it is foreign to this server).
    emojiDisplay: isCustomEmojiId(board.emoji) ? reaction.emoji.toString() : board.emoji,
  });
}

async function runBoard(
  moduleManager: ModuleManager,
  board: StarboardBoard,
  message: Message,
  reaction: MessageReaction,
): Promise<void> {
  const guild = message.guild!;
  const guildId = guild.id;
  const deps: ProcessDeps = {
    posts: moduleManager.databaseService.starboardPosts,
    countStars: () => countReactors(reaction, message.author.id),
    sendPost: async (count) => {
      try {
        const channel = await boardChannel(guild, board);
        const sent = await channel.send({
          ...payloadFor(message, board, count, reaction),
          allowedMentions: { parse: [] },
        });
        return sent.id;
      } catch (err) {
        warnOnce(moduleManager, guildId, board, err);
        return null;
      }
    },
    editPost: async (boardMessageId, count) => {
      try {
        const channel = await boardChannel(guild, board);
        await channel.messages.edit(boardMessageId, {
          ...payloadFor(message, board, count, reaction),
          allowedMentions: { parse: [] },
        });
        return "ok";
      } catch (err) {
        if (isUnknownMessage(err)) return "missing";
        // Missing channel, no access, etc.: warn (throttled) and leave the row alone.
        warnOnce(moduleManager, guildId, board, err);
        return "failed";
      }
    },
    deletePost: async (boardMessageId) => {
      try {
        const channel = await boardChannel(guild, board);
        await channel.messages.delete(boardMessageId);
      } catch (err) {
        if (!isUnknownMessage(err)) warnOnce(moduleManager, guildId, board, err);
      }
    },
  };

  await processBoard(deps, board, {
    guildId,
    channelId: message.channelId,
    messageId: message.id,
    authorId: message.author.id,
  });
}

async function onReaction(
  moduleManager: ModuleManager,
  rawReaction: MessageReaction | PartialMessageReaction,
  rawUser: User | PartialUser,
): Promise<void> {
  if (rawUser.bot) return;

  // Decide everything possible from fields already present on partials before
  // any REST fetch, so reactions in non-starboard guilds/DMs cost nothing.
  const guildId = rawReaction.message.guildId;
  if (!guildId) return;

  const boards = await loadBoards(moduleManager, guildId, true);
  if (boards.length === 0) return;

  const key = emojiKey(rawReaction.emoji);
  const matching = boards.filter((b) => boardMatchesEmoji(b, key));
  if (matching.length === 0) return;

  let reaction: MessageReaction;
  let message: Message;
  try {
    reaction = rawReaction.partial ? await rawReaction.fetch() : rawReaction;
    message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
  } catch (err) {
    // The message was deleted while we were handling the event: nothing to do.
    if (isUnknownMessage(err)) return;
    throw err;
  }
  const guild = message.guild;
  if (!guild || !message.author) return;

  const channel = message.channel;
  const isThread = channel.isThread();
  const sourceChannel = {
    id: channel.id,
    parentId: isThread ? channel.parentId : null,
    nsfw: isThread
      ? channel.parent?.nsfw === true
      : "nsfw" in channel && channel.nsfw === true,
  };
  // Every board channel of the guild (enabled or not) is off-limits as a source.
  const allBoards = await loadBoards(moduleManager, guildId, false);
  const boardChannelIds = new Set(allBoards.map((b) => b.channelId));
  const sourcePublic = viewableByEveryone(guild, channel);

  for (const board of matching) {
    if (!isEligibleChannel(board, sourceChannel, boardChannelIds)) continue;
    // Privacy: never mirror a channel @everyone cannot see into one they can.
    if (!sourcePublic) {
      const boardPublic = viewableByEveryone(guild, await resolveBoardChannel(guild, board));
      if (isLeakToPublicBoard(sourcePublic, boardPublic)) continue;
    }
    void coalescer.run(`${board.id}:${message.id}`, async () => {
      try {
        await runBoard(moduleManager, board, message, reaction);
      } catch (err) {
        // The message vanished mid-update: not worth an error log.
        if (isUnknownMessage(err)) return;
        moduleManager.logger.error("Starboard update failed", guild.id, err, MODULE);
      }
    });
  }
}

/** Deletes a board's mirrored post (if any) for a source message that went away. */
async function dropBoardPost(
  moduleManager: ModuleManager,
  guildId: string,
  board: StarboardBoard | undefined,
  boardMessageId: string | null,
): Promise<void> {
  if (!board || !boardMessageId) return;
  try {
    const guild = moduleManager.client.guilds.cache.get(guildId);
    if (!guild) throw new Error(`guild ${guildId} is not cached`);
    const channel = await boardChannel(guild, board);
    await channel.messages.delete(boardMessageId);
  } catch (err) {
    if (!isUnknownMessage(err)) {
      warnOnce(moduleManager, guildId, board, err);
    }
  }
}

/** The source message was deleted or had all reactions cleared: remove every board's post for it. */
async function removeAllForMessage(
  moduleManager: ModuleManager,
  guildId: string,
  messageId: string,
): Promise<void> {
  const rows = await moduleManager.databaseService.starboardPosts.deleteBySourceMessage(
    guildId,
    messageId,
  );
  if (rows.length === 0) return;
  const boards = await loadBoards(moduleManager, guildId, false);
  for (const row of rows) {
    await dropBoardPost(
      moduleManager,
      guildId,
      boards.find((b) => b.id === row.boardId),
      row.boardMessageId,
    );
  }
}

/** One emoji was cleared from the message: remove the posts of boards that use it. */
async function removeEmojiForMessage(
  moduleManager: ModuleManager,
  guildId: string,
  messageId: string,
  key: string,
): Promise<void> {
  const posts = moduleManager.databaseService.starboardPosts;
  const boards = (await loadBoards(moduleManager, guildId, false)).filter((b) =>
    boardMatchesEmoji(b, key),
  );
  if (boards.length === 0) return;
  const rows = await posts.listBySourceMessage(guildId, messageId);
  for (const board of boards) {
    const row = rows.find((r) => r.boardId === board.id);
    if (!row) continue;
    await posts.deleteById(row.id);
    await dropBoardPost(moduleManager, guildId, board, row.boardMessageId);
  }
}

let cleaning = false;

/**
 * Deletes posts that belong to boards no longer present in a guild's settings.
 * Runs on every shard over the guilds that shard owns (like the autoroles
 * sweep): each guild belongs to exactly one shard, so there is no duplicate
 * work, and leader gating would skip every other shard's guilds.
 */
async function runCleanup(moduleManager: ModuleManager): Promise<void> {
  if (cleaning) return;
  cleaning = true;
  try {
    for (const guild of moduleManager.client.guilds.cache.values()) {
      try {
        const settings = await moduleManager.databaseService.getModuleSettings(guild.id, MODULE);
        const { allBoardIds } = parseStarboard(settings);
        // null = settings missing or a swallowed DB error ({}): never reconcile on that.
        if (allBoardIds === null) continue;
        await moduleManager.databaseService.starboardPosts.deleteBoardsNotIn(guild.id, allBoardIds);
      } catch (err) {
        moduleManager.logger.error("Starboard cleanup failed for guild", guild.id, err, MODULE);
      }
    }
  } finally {
    cleaning = false;
  }
}

function registerStarboardEvents(moduleManager: ModuleManager): void {
  const { client, logger } = moduleManager;
  const guard = (label: string, guildId: string | null | undefined, work: Promise<unknown>) =>
    work.catch((err) => logger.error(`Starboard ${label} failed`, guildId ?? undefined, err, MODULE));

  client.on(Events.MessageReactionAdd, (reaction, user) => {
    void guard("reaction add", reaction.message.guildId, onReaction(moduleManager, reaction, user));
  });
  client.on(Events.MessageReactionRemove, (reaction, user) => {
    void guard("reaction remove", reaction.message.guildId, onReaction(moduleManager, reaction, user));
  });
  client.on(Events.MessageReactionRemoveAll, (message) => {
    if (!message.guildId) return;
    void guard("clear reactions", message.guildId, removeAllForMessage(moduleManager, message.guildId, message.id));
  });
  client.on(Events.MessageReactionRemoveEmoji, (reaction) => {
    const guildId = reaction.message.guildId;
    if (!guildId) return;
    void guard(
      "clear emoji",
      guildId,
      removeEmojiForMessage(moduleManager, guildId, reaction.message.id, emojiKey(reaction.emoji)),
    );
  });
  client.on(Events.MessageDelete, (message: Message | PartialMessage) => {
    if (!message.guildId) return;
    void guard("message delete", message.guildId, removeAllForMessage(moduleManager, message.guildId, message.id));
  });
  client.on(Events.MessageBulkDelete, (messages) => {
    for (const message of messages.values()) {
      if (!message.guildId) continue;
      void guard("bulk delete", message.guildId, removeAllForMessage(moduleManager, message.guildId, message.id));
    }
  });

  setTimeout(() => {
    void runCleanup(moduleManager);
    setInterval(() => void runCleanup(moduleManager), CLEANUP_INTERVAL_MS).unref();
  }, FIRST_CLEANUP_DELAY_MS).unref();

  logger.info("Starboard events registered.", undefined, MODULE);
}

const starboardModule: BotModule = {
  name: MODULE,
  description: "Mirrors popular messages to a board channel once they collect enough star reactions",
  registerEvents: registerStarboardEvents,
  meta: {
    displayName: "Starboard",
    category: "engagement",
    icon: "i-lucide-star",
    color: "yellow",
    tags: ["starboard", "stars", "reactions", "highlights", "hall-of-fame"],
  },
  // No slash command: configured entirely from the dashboard. ModuleManager
  // still requires an execute function to load a module.
  execute: async () => undefined,
};

export default starboardModule;
