/**
 * StarboardPostRepository — tracks which source messages the starboard
 * module has mirrored to a board channel, and the star count last shown.
 */
import { and, desc, eq, notInArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import { starboardPosts, type StarboardPostRow } from "../schema";

export interface StarboardPostInput {
  guildId: string;
  boardId: string;
  sourceChannelId: string;
  sourceMessageId: string;
  authorId: string;
  boardMessageId: string | null;
  starCount: number;
}

export interface StarboardAuthorTotal {
  authorId: string;
  posts: number;
  stars: number;
}

export class StarboardPostRepository {
  constructor(private db: Database) {}

  async get(
    guildId: string,
    boardId: string,
    sourceMessageId: string,
  ): Promise<StarboardPostRow | null> {
    const rows = await this.db
      .select()
      .from(starboardPosts)
      .where(
        and(
          eq(starboardPosts.guildId, guildId),
          eq(starboardPosts.boardId, boardId),
          eq(starboardPosts.sourceMessageId, sourceMessageId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async listBySourceMessage(guildId: string, sourceMessageId: string): Promise<StarboardPostRow[]> {
    return this.db
      .select()
      .from(starboardPosts)
      .where(
        and(
          eq(starboardPosts.guildId, guildId),
          eq(starboardPosts.sourceMessageId, sourceMessageId),
        ),
      );
  }

  /** Returns the inserted row, or null when (guild, board, message) already has one. */
  async insertIfAbsent(input: StarboardPostInput): Promise<StarboardPostRow | null> {
    const rows = await this.db.insert(starboardPosts).values(input).onConflictDoNothing().returning();
    return rows[0] ?? null;
  }

  async update(
    id: string,
    patch: { boardMessageId?: string | null; starCount?: number },
  ): Promise<void> {
    await this.db
      .update(starboardPosts)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(starboardPosts.id, id));
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(starboardPosts).where(eq(starboardPosts.id, id));
  }

  /** Deletes every board's row for the message and returns them (callers need `boardMessageId`). */
  async deleteBySourceMessage(guildId: string, sourceMessageId: string): Promise<StarboardPostRow[]> {
    return this.db
      .delete(starboardPosts)
      .where(
        and(
          eq(starboardPosts.guildId, guildId),
          eq(starboardPosts.sourceMessageId, sourceMessageId),
        ),
      )
      .returning();
  }

  /** Deletes the guild's rows whose board id is not in `keepBoardIds`. Returns rows deleted. */
  async deleteBoardsNotIn(guildId: string, keepBoardIds: string[]): Promise<number> {
    const where =
      keepBoardIds.length > 0
        ? and(eq(starboardPosts.guildId, guildId), notInArray(starboardPosts.boardId, keepBoardIds))
        : eq(starboardPosts.guildId, guildId);
    const rows = await this.db.delete(starboardPosts).where(where).returning({ id: starboardPosts.id });
    return rows.length;
  }

  async topPosts(guildId: string, boardId: string, limit: number): Promise<StarboardPostRow[]> {
    return this.db
      .select()
      .from(starboardPosts)
      .where(and(eq(starboardPosts.guildId, guildId), eq(starboardPosts.boardId, boardId)))
      .orderBy(desc(starboardPosts.starCount), desc(starboardPosts.createdAt))
      .limit(limit);
  }

  async topAuthors(guildId: string, boardId: string, limit: number): Promise<StarboardAuthorTotal[]> {
    return this.db
      .select({
        authorId: starboardPosts.authorId,
        posts: sql<number>`count(*)::int`,
        stars: sql<number>`coalesce(sum(${starboardPosts.starCount}), 0)::int`,
      })
      .from(starboardPosts)
      .where(and(eq(starboardPosts.guildId, guildId), eq(starboardPosts.boardId, boardId)))
      .groupBy(starboardPosts.authorId)
      .orderBy(desc(sql`sum(${starboardPosts.starCount})`))
      .limit(limit);
  }
}
