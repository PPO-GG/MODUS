import type { StarboardBoard } from "../../lib/schemas";

export type StarAction =
  | { type: "noop" }
  | { type: "create" }
  | { type: "update" }
  | { type: "delete" };

export interface ExistingPost {
  id: string;
  /** null when the mirrored post was deleted by hand. */
  boardMessageId: string | null;
  starCount: number;
}

/** What to do given the live star count and what (if anything) is already posted. */
export function decide(input: {
  count: number;
  threshold: number;
  existing: ExistingPost | null;
  deleteBelowThreshold: boolean;
}): StarAction {
  const { count, threshold, existing, deleteBelowThreshold } = input;

  if (count >= threshold) {
    if (!existing || existing.boardMessageId === null) return { type: "create" };
    return count === existing.starCount ? { type: "noop" } : { type: "update" };
  }

  if (!existing) return { type: "noop" };
  if (deleteBelowThreshold || existing.boardMessageId === null) return { type: "delete" };
  return count === existing.starCount ? { type: "noop" } : { type: "update" };
}

export interface SourceChannel {
  id: string;
  /** Parent channel for threads, otherwise null. */
  parentId: string | null;
  /** For threads, the caller resolves this from the parent channel. */
  nsfw: boolean;
}

/** Whether a message in `channel` may be mirrored by `board`. */
export function isEligibleChannel(
  board: StarboardBoard,
  channel: SourceChannel,
  boardChannelIds: ReadonlySet<string>,
): boolean {
  if (channel.nsfw) return false;
  if (boardChannelIds.has(channel.id)) return false;
  if (board.ignoredChannelIds.includes(channel.id)) return false;
  if (channel.parentId !== null && board.ignoredChannelIds.includes(channel.parentId)) return false;
  // A thread started on a board post lives under the board channel.
  if (channel.parentId !== null && boardChannelIds.has(channel.parentId)) return false;
  return true;
}

/**
 * Privacy rule: a source @everyone cannot see must never be mirrored into a
 * board @everyone can see. A private board may still mirror private sources.
 */
export function isLeakToPublicBoard(
  sourceViewableByEveryone: boolean,
  boardViewableByEveryone: boolean,
): boolean {
  return !sourceViewableByEveryone && boardViewableByEveryone;
}
