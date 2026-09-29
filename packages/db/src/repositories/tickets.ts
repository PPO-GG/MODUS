import { and, asc, eq, inArray, lt, notInArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import { ticketRecords, type TicketRow } from "../schema";

export interface TicketUpsertInput {
  guildId: string;
  threadId: string;
  ticketNumber: number;
  ownerId: string;
  ownerTag?: string | null;
  typeId: string | null;
  priority: "low" | "normal" | "high" | "critical";
  status: "open" | "claimed" | "closed";
  claimedBy: string | null;
  claimedByTag?: string | null;
  openedAt: Date;
}

const OPEN_STATUSES = ["open", "claimed"];

export class TicketRepository {
  constructor(private db: Database) {}

  async upsert(input: TicketUpsertInput): Promise<void> {
    await this.db
      .insert(ticketRecords)
      .values({ ...input, ownerTag: input.ownerTag ?? null, claimedByTag: input.claimedByTag ?? null })
      .onConflictDoUpdate({
        target: ticketRecords.threadId,
        set: {
          ticketNumber: input.ticketNumber,
          ownerId: input.ownerId,
          // A null tag (e.g. from the startup scan with a cold cache) keeps the known one.
          ownerTag: sql`coalesce(excluded.owner_tag, ${ticketRecords.ownerTag})`,
          typeId: input.typeId,
          priority: input.priority,
          status: input.status,
          claimedBy: input.claimedBy,
          claimedByTag: input.claimedBy ? sql`coalesce(excluded.claimed_by_tag, ${ticketRecords.claimedByTag})` : null,
          openedAt: input.openedAt,
          updatedAt: new Date(),
        },
      });
  }

  async markClosed(threadId: string, closedAt: Date = new Date()): Promise<void> {
    await this.db
      .update(ticketRecords)
      .set({ status: "closed", closedAt, updatedAt: new Date() })
      .where(eq(ticketRecords.threadId, threadId));
  }

  /** Close this guild's open rows whose thread is not in the active set. Returns rows closed. */
  async closeMissing(guildId: string, activeThreadIds: string[], olderThan?: Date): Promise<number> {
    const conditions = [eq(ticketRecords.guildId, guildId), inArray(ticketRecords.status, OPEN_STATUSES)];
    if (activeThreadIds.length > 0) conditions.push(notInArray(ticketRecords.threadId, activeThreadIds));
    // Skip rows touched after the scan began so a ticket opened mid-scan isn't closed.
    if (olderThan) conditions.push(lt(ticketRecords.updatedAt, olderThan));
    const rows = await this.db
      .update(ticketRecords)
      .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: ticketRecords.id });
    return rows.length;
  }

  async listOpen(guildId: string): Promise<TicketRow[]> {
    return await this.db
      .select()
      .from(ticketRecords)
      .where(and(eq(ticketRecords.guildId, guildId), inArray(ticketRecords.status, OPEN_STATUSES)))
      .orderBy(asc(ticketRecords.openedAt));
  }
}
