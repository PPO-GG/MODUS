/**
 * BotFeedbackRepository — feedback server admins send to the bot owner.
 */
import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import { requireReturningRow, type Database } from "../client";
import { botFeedback, type BotFeedbackRow } from "../schema";

export type FeedbackCategory = "bug" | "idea" | "other";
export type FeedbackStatus = "open" | "resolved";

/** Shape of `bot_feedback.context` when `v` is 1. Readers must tolerate other versions. */
export interface FeedbackContextV1 {
  v: 1;
  guildName: string;
  memberCount: number | null;
  shardId: number | null;
  botVersion: string;
  locale: string | null;
}

export class BotFeedbackRepository {
  constructor(private db: Database) {}

  async create(input: {
    guildId: string;
    userId: string;
    category: FeedbackCategory;
    message: string;
    contactOk: boolean;
    context: FeedbackContextV1;
  }): Promise<BotFeedbackRow> {
    const [row] = await this.db.insert(botFeedback).values(input).returning();
    return requireReturningRow(row, "bot_feedback insert");
  }

  /** Rows the user created at or after `since`. */
  async countSince(userId: string, since: Date): Promise<number> {
    const [row] = await this.db
      .select({ n: count() })
      .from(botFeedback)
      .where(and(eq(botFeedback.userId, userId), gte(botFeedback.createdAt, since)));
    return row?.n ?? 0;
  }

  /** Newest first. `before` is an exclusive createdAt cursor. */
  async list(q: {
    status?: FeedbackStatus;
    limit: number;
    before?: Date;
  }): Promise<BotFeedbackRow[]> {
    const conditions = [];
    if (q.status) conditions.push(eq(botFeedback.status, q.status));
    if (q.before) conditions.push(lt(botFeedback.createdAt, q.before));
    return this.db
      .select()
      .from(botFeedback)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(botFeedback.createdAt))
      .limit(q.limit);
  }

  /** Resolving stamps resolvedAt/resolvedBy; reopening clears both. Null when the id is unknown. */
  async setStatus(
    id: string,
    status: FeedbackStatus,
    actorId: string,
  ): Promise<BotFeedbackRow | null> {
    const resolved = status === "resolved";
    const [row] = await this.db
      .update(botFeedback)
      .set({
        status,
        resolvedAt: resolved ? new Date() : null,
        resolvedBy: resolved ? actorId : null,
      })
      .where(eq(botFeedback.id, id))
      .returning();
    return row ?? null;
  }
}
