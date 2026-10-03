/**
 * SuggestionRepository — member suggestions and their review state.
 */
import { and, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { requireReturningRow, type Database } from "../client";
import { suggestions, type SuggestionRow } from "../schema";

export const SUGGESTION_STATUSES = [
  "pending",
  "considering",
  "approved",
  "denied",
  "implemented",
  "withdrawn",
] as const;
export type SuggestionStatus = (typeof SUGGESTION_STATUSES)[number];

export class SuggestionRepository {
  constructor(private db: Database) {}

  /**
   * Inserts a pending suggestion with the guild's next number. A per-guild
   * advisory lock held for the transaction serializes concurrent creates, so
   * `max + 1` cannot collide; the unique index is the backstop.
   */
  async create(input: {
    guildId: string;
    authorId: string;
    title: string;
    body: string;
  }): Promise<SuggestionRow> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.guildId}))`);
      const rows = await tx
        .select({ next: sql<number>`coalesce(max(${suggestions.number}), 0) + 1` })
        .from(suggestions)
        .where(eq(suggestions.guildId, input.guildId));
      const next = rows[0]?.next ?? 1;
      const [row] = await tx
        .insert(suggestions)
        .values({
          guildId: input.guildId,
          number: next,
          authorId: input.authorId,
          title: input.title,
          body: input.body,
        })
        .returning();
      return requireReturningRow(row, "suggestions insert");
    });
  }

  async getById(id: string): Promise<SuggestionRow | null> {
    const rows = await this.db.select().from(suggestions).where(eq(suggestions.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async getByNumber(guildId: string, number: number): Promise<SuggestionRow | null> {
    const rows = await this.db
      .select()
      .from(suggestions)
      .where(and(eq(suggestions.guildId, guildId), eq(suggestions.number, number)))
      .limit(1);
    return rows[0] ?? null;
  }

  async setPost(
    id: string,
    post: { channelId: string; messageId: string; threadId?: string | null },
  ): Promise<void> {
    await this.db
      .update(suggestions)
      .set({
        channelId: post.channelId,
        messageId: post.messageId,
        ...(post.threadId !== undefined ? { threadId: post.threadId } : {}),
      })
      .where(eq(suggestions.id, id));
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(suggestions).where(eq(suggestions.id, id));
  }

  /**
   * Records a staff review. `withdrawn` is terminal and system-set (the Discord
   * message or channel disappeared), so a withdrawn suggestion is never
   * updated. Returns the updated row, or `null` when nothing was updated
   * (the suggestion is withdrawn or does not exist).
   */
  async setStatus(
    id: string,
    change: {
      status: Exclude<(typeof SUGGESTION_STATUSES)[number], "withdrawn">;
      reason: string | null;
      reviewedBy: string;
    },
  ): Promise<SuggestionRow | null> {
    const [row] = await this.db
      .update(suggestions)
      .set({
        status: change.status,
        statusReason: change.reason,
        reviewedBy: change.reviewedBy,
        reviewedAt: new Date(),
      })
      .where(and(eq(suggestions.id, id), ne(suggestions.status, "withdrawn")))
      .returning();
    return row ?? null;
  }

  async markWithdrawn(id: string): Promise<void> {
    await this.db.update(suggestions).set({ status: "withdrawn" }).where(eq(suggestions.id, id));
  }

  /** Marks the not-yet-withdrawn suggestion posted as `messageId` withdrawn. Returns rows changed. */
  async markWithdrawnByMessage(guildId: string, messageId: string): Promise<number> {
    const rows = await this.db
      .update(suggestions)
      .set({ status: "withdrawn" })
      .where(
        and(
          eq(suggestions.guildId, guildId),
          eq(suggestions.messageId, messageId),
          ne(suggestions.status, "withdrawn"),
        ),
      )
      .returning({ id: suggestions.id });
    return rows.length;
  }

  /** Marks the not-yet-withdrawn suggestions posted as any of `messageIds` withdrawn (bulk delete). Returns rows changed. */
  async markWithdrawnByMessages(guildId: string, messageIds: string[]): Promise<number> {
    if (messageIds.length === 0) return 0;
    const rows = await this.db
      .update(suggestions)
      .set({ status: "withdrawn" })
      .where(
        and(
          eq(suggestions.guildId, guildId),
          inArray(suggestions.messageId, messageIds),
          ne(suggestions.status, "withdrawn"),
        ),
      )
      .returning({ id: suggestions.id });
    return rows.length;
  }

  /** Marks every not-yet-withdrawn suggestion posted in `channelId` withdrawn. Returns rows changed. */
  async markWithdrawnByChannel(guildId: string, channelId: string): Promise<number> {
    const rows = await this.db
      .update(suggestions)
      .set({ status: "withdrawn" })
      .where(
        and(
          eq(suggestions.guildId, guildId),
          eq(suggestions.channelId, channelId),
          ne(suggestions.status, "withdrawn"),
        ),
      )
      .returning({ id: suggestions.id });
    return rows.length;
  }

  /** Newest first. `before` is an exclusive createdAt cursor. */
  async list(
    guildId: string,
    opts: { status?: (typeof SUGGESTION_STATUSES)[number]; limit: number; before?: Date },
  ): Promise<SuggestionRow[]> {
    const conditions = [eq(suggestions.guildId, guildId)];
    if (opts.status) conditions.push(eq(suggestions.status, opts.status));
    if (opts.before) conditions.push(lt(suggestions.createdAt, opts.before));
    return this.db
      .select()
      .from(suggestions)
      .where(and(...conditions))
      .orderBy(desc(suggestions.createdAt))
      .limit(opts.limit);
  }

  /** Non-withdrawn suggestions whose number starts with the digits in `numberPrefix`, highest number first. */
  async listForAutocomplete(
    guildId: string,
    numberPrefix: string,
    limit: number,
  ): Promise<SuggestionRow[]> {
    const digits = numberPrefix.replace(/\D/g, "");
    const conditions = [eq(suggestions.guildId, guildId), ne(suggestions.status, "withdrawn")];
    if (digits) conditions.push(sql`${suggestions.number}::text like ${`${digits}%`}`);
    return this.db
      .select()
      .from(suggestions)
      .where(and(...conditions))
      .orderBy(desc(suggestions.number))
      .limit(limit);
  }
}
