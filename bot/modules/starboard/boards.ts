import {
  MAX_STARBOARDS_PER_GUILD,
  StarboardBoardSchema,
  type StarboardBoard,
} from "../../lib/schemas";

/** Removes the emoji variation selector (U+FE0F) so ❤ and ❤️ compare equal. */
export function normalizeEmoji(value: string): string {
  return value.replace(/\uFE0F/g, "").trim();
}

/** Comparable key for a reaction's emoji: custom → id, unicode → normalized glyph. */
export function emojiKey(emoji: { id: string | null; name: string | null }): string {
  if (emoji.id) return emoji.id;
  return normalizeEmoji(emoji.name ?? "");
}

export function boardMatchesEmoji(board: StarboardBoard, key: string): boolean {
  return key !== "" && normalizeEmoji(board.emoji) === key;
}

export interface ParsedStarboard {
  /** Valid boards (enabled or not), duplicates dropped, capped at MAX_STARBOARDS_PER_GUILD. */
  boards: StarboardBoard[];
  /**
   * Ids of EVERY stored board, valid or not, so orphan cleanup never deletes the
   * posts of a board that is merely malformed. null means the settings had no
   * `boards` array at all (config row absent, or DatabaseService swallowed a DB
   * error and returned {}) — callers must NOT reconcile in that case.
   */
  allBoardIds: string[] | null;
  invalidCount: number;
}

export function parseStarboard(raw: unknown): ParsedStarboard {
  const stored = (raw as { boards?: unknown } | null | undefined)?.boards;
  if (!Array.isArray(stored)) {
    return { boards: [], allBoardIds: null, invalidCount: 0 };
  }

  const boards: StarboardBoard[] = [];
  const allBoardIds: string[] = [];
  const seen = new Set<string>();
  let invalidCount = 0;

  for (const entry of stored) {
    const id = (entry as { id?: unknown } | null)?.id;
    if (typeof id === "string" && id.length > 0) allBoardIds.push(id);
    const parsed = StarboardBoardSchema.safeParse(entry);
    if (!parsed.success) {
      invalidCount++;
      continue;
    }
    const pairKey = `${normalizeEmoji(parsed.data.emoji)}|${parsed.data.channelId}`;
    if (seen.has(pairKey)) {
      invalidCount++;
      continue;
    }
    seen.add(pairKey);
    if (boards.length < MAX_STARBOARDS_PER_GUILD) boards.push(parsed.data);
  }

  return { boards, allBoardIds, invalidCount };
}
