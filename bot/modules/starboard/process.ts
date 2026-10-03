import type { StarboardPostRepository } from "@modus/db";
import type { StarboardBoard } from "../../lib/schemas";
import { decide, type StarAction } from "./evaluate";

export type PostStore = Pick<
  StarboardPostRepository,
  "get" | "insertIfAbsent" | "update" | "deleteById"
>;

export interface SourceRef {
  guildId: string;
  channelId: string;
  messageId: string;
  authorId: string;
}

/** Everything that touches Discord or the clock is injected, so the flow is unit-testable. */
export interface ProcessDeps {
  posts: PostStore;
  /** Live reactor count for this board's emoji, excluding bots and the author. */
  countStars(): Promise<number>;
  /** Sends the board post; returns its message id, or null if it could not be sent. */
  sendPost(count: number): Promise<string | null>;
  /**
   * Edits the board post. "missing" when it no longer exists; "failed" for any
   * other error (the dep warns, throttled) so the row is left as it was.
   */
  editPost(boardMessageId: string, count: number): Promise<"ok" | "missing" | "failed">;
  deletePost(boardMessageId: string): Promise<void>;
}

/** Recounts one (board, message) pair and brings the board post in line. Returns the action taken. */
export async function processBoard(
  deps: ProcessDeps,
  board: StarboardBoard,
  source: SourceRef,
): Promise<StarAction["type"]> {
  const existing = await deps.posts.get(source.guildId, board.id, source.messageId);
  const count = await deps.countStars();
  const action = decide({
    count,
    threshold: board.threshold,
    existing,
    deleteBelowThreshold: board.deleteBelowThreshold,
  });

  switch (action.type) {
    case "noop":
      break;

    case "create": {
      const boardMessageId = await deps.sendPost(count);
      if (!boardMessageId) break;
      if (existing) {
        try {
          await deps.posts.update(existing.id, { boardMessageId, starCount: count });
        } catch (err) {
          // Cleanup: best-effort delete the orphaned board post.
          try {
            await deps.deletePost(boardMessageId);
          } catch {
            // Swallow cleanup errors; the original error is more important.
          }
          throw err;
        }
        break;
      }
      try {
        const inserted = await deps.posts.insertIfAbsent({
          guildId: source.guildId,
          boardId: board.id,
          sourceChannelId: source.channelId,
          sourceMessageId: source.messageId,
          authorId: source.authorId,
          boardMessageId,
          starCount: count,
        });
        // Lost a race for the unique (guild, board, message) row: drop our duplicate post.
        if (!inserted) await deps.deletePost(boardMessageId);
      } catch (err) {
        // Cleanup: best-effort delete the orphaned board post.
        try {
          await deps.deletePost(boardMessageId);
        } catch {
          // Swallow cleanup errors; the original error is more important.
        }
        throw err;
      }
      break;
    }

    case "update": {
      if (!existing) break;
      if (existing.boardMessageId === null) {
        await deps.posts.update(existing.id, { starCount: count });
        break;
      }
      const result = await deps.editPost(existing.boardMessageId, count);
      // Transient/permission failure (already warned by the dep): keep the row so the next reaction retries.
      if (result === "failed") break;
      await deps.posts.update(
        existing.id,
        result === "missing" ? { boardMessageId: null, starCount: count } : { starCount: count },
      );
      break;
    }

    case "delete": {
      if (!existing) break;
      if (existing.boardMessageId) await deps.deletePost(existing.boardMessageId);
      await deps.posts.deleteById(existing.id);
      break;
    }
  }

  return action.type;
}
