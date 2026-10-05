/**
 * Pure helpers for the Starboard dashboard page. The limits here mirror
 * StarboardBoardSchema in bot/lib/schemas.ts — keep them in sync.
 */

export const MAX_BOARDS = 10;
export const MAX_NAME_LENGTH = 80;
export const MAX_WATCHED_CHANNELS = 100;
export const EMOJI_PRESETS = ["⭐", "🌟", "💀", "❤️", "😂", "🔥", "👍"];

export interface BoardDraft {
  id: string;
  name: string;
  enabled: boolean;
  /** A unicode emoji, or a custom-emoji id. */
  emoji: string;
  threshold: number;
  channelId: string;
  ignoredChannelIds: string[];
  /** Only these channels (and their threads) count; empty = every channel. */
  watchedChannelIds: string[];
  /** The bot seeds this board's emoji on images in the watched channels. */
  autoReact: boolean;
  deleteBelowThreshold: boolean;
}

/** Removes the emoji variation selector so ❤ and ❤️ compare equal. */
export function normalizeEmoji(value: string): string {
  return value.replace(/\uFE0F/g, "").trim();
}

export function isCustomEmoji(emoji: string): boolean {
  return /^\d{15,25}$/.test(emoji);
}

/** Unicode glyph as typed, or the id of a pasted custom emoji; null when it is neither. */
export function parseEmojiInput(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  const pasted = /^<a?:\w{2,32}:(\d{15,25})>$/.exec(value);
  if (pasted) return pasted[1]!;
  if (isCustomEmoji(value)) return value;

  // For unicode emoji: must be exactly one grapheme and either:
  // - contains Extended_Pictographic, or
  // - is a regional-indicator pair (flag), or
  // - is a keycap sequence
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const segments = Array.from(segmenter.segment(value)).map((s) => s.segment);

  if (segments.length === 1) {
    const grapheme = segments[0]!;
    if (/\p{Extended_Pictographic}/u.test(grapheme)) return grapheme;
    if (/^\p{Regional_Indicator}{2}$/u.test(grapheme)) return grapheme;
    if (/^[0-9#*]\uFE0F?\u20E3$/u.test(grapheme)) return grapheme;
  }

  return null;
}

export function newBoard(id: string): BoardDraft {
  return {
    id,
    name: "",
    enabled: true,
    emoji: "⭐",
    threshold: 3,
    channelId: "",
    ignoredChannelIds: [],
    watchedChannelIds: [],
    autoReact: false,
    deleteBelowThreshold: false,
  };
}

/** First problem with a board draft, or null when it can be saved. `others` excludes the draft itself. */
export function validateBoard(board: BoardDraft, others: BoardDraft[]): string | null {
  if (!board.name.trim()) return "Give the board a name.";
  if (board.name.trim().length > MAX_NAME_LENGTH)
    return `Name must be ${MAX_NAME_LENGTH} characters or fewer.`;
  const emoji = parseEmojiInput(board.emoji);
  if (!emoji) return "Pick a valid emoji (a unicode emoji, or a pasted custom emoji).";
  if (!Number.isInteger(board.threshold) || board.threshold < 1 || board.threshold > 100) {
    return "Threshold must be a whole number between 1 and 100.";
  }
  if (!board.channelId) return "Choose the channel posts go to.";
  if (board.ignoredChannelIds.length > 100) return "Ignore at most 100 channels.";
  if (board.watchedChannelIds.length > MAX_WATCHED_CHANNELS)
    return `Watch at most ${MAX_WATCHED_CHANNELS} channels.`;
  if (board.autoReact && board.watchedChannelIds.length === 0)
    return "Pick at least one watched channel to turn on vote reactions.";
  // The bot never treats a board channel as a source, so watching one silently does nothing.
  const boardChannelIds = new Set([board.channelId, ...others.map((o) => o.channelId)]);
  if (board.watchedChannelIds.some((id) => boardChannelIds.has(id)))
    return "A board channel can't be a watched channel. Post this board somewhere else, or stop watching it.";
  if (others.some((o) => o.watchedChannelIds.includes(board.channelId)))
    return "Another board watches this channel, so it can't be a board channel.";
  const clash = others.some(
    (o) =>
      o.channelId === board.channelId &&
      normalizeEmoji(parseEmojiInput(o.emoji) ?? o.emoji) === normalizeEmoji(emoji),
  );
  if (clash) return "Another board already uses this emoji and channel.";
  return null;
}

/** Normalised copy for saving: trimmed name, emoji reduced to its stored form, auto-react only with a watched channel. */
export function toSavedBoard(board: BoardDraft): BoardDraft {
  return {
    ...board,
    name: board.name.trim(),
    emoji: parseEmojiInput(board.emoji) ?? board.emoji.trim(),
    autoReact: board.autoReact && board.watchedChannelIds.length > 0,
  };
}

export function describeBoard(board: BoardDraft, channelName: string): string {
  const emoji = isCustomEmoji(board.emoji) ? "custom emoji" : board.emoji;
  return `${emoji} ≥ ${board.threshold} → #${channelName}`;
}
