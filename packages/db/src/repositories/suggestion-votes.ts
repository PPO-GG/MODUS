/**
 * SuggestionVoteRepository — one ▲/▼ vote per (suggestion, user).
 */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import { suggestionVotes } from "../schema";

export type VoteDirection = "up" | "down";
export type ToggleResult = "added" | "removed" | "switched";

export interface VoteTally {
  up: number;
  down: number;
}

export class SuggestionVoteRepository {
  constructor(private db: Database) {}

  /**
   * Same direction again removes the vote, the opposite direction switches it,
   * no existing vote adds one. The row lock serializes a user's rapid clicks.
   */
  async toggle(
    suggestionId: string,
    userId: string,
    direction: VoteDirection,
  ): Promise<ToggleResult> {
    return this.db.transaction(async (tx) => {
      const where = and(
        eq(suggestionVotes.suggestionId, suggestionId),
        eq(suggestionVotes.userId, userId),
      );
      const [existing] = await tx.select().from(suggestionVotes).where(where).for("update");
      if (!existing) {
        await tx
          .insert(suggestionVotes)
          .values({ suggestionId, userId, direction })
          .onConflictDoNothing();
        return "added";
      }
      if (existing.direction === direction) {
        await tx.delete(suggestionVotes).where(where);
        return "removed";
      }
      await tx.update(suggestionVotes).set({ direction }).where(where);
      return "switched";
    });
  }

  async tally(suggestionId: string): Promise<VoteTally> {
    return (await this.tallies([suggestionId])).get(suggestionId) ?? { up: 0, down: 0 };
  }

  /** Tallies for many suggestions in one query; every requested id is present in the result. */
  async tallies(suggestionIds: string[]): Promise<Map<string, VoteTally>> {
    const result = new Map<string, VoteTally>();
    if (suggestionIds.length === 0) return result;
    for (const id of suggestionIds) result.set(id, { up: 0, down: 0 });
    const rows = await this.db
      .select({
        suggestionId: suggestionVotes.suggestionId,
        direction: suggestionVotes.direction,
        votes: sql<number>`count(*)::int`,
      })
      .from(suggestionVotes)
      .where(inArray(suggestionVotes.suggestionId, suggestionIds))
      .groupBy(suggestionVotes.suggestionId, suggestionVotes.direction);
    for (const row of rows) {
      const tally = result.get(row.suggestionId)!;
      if (row.direction === "up") tally.up = row.votes;
      else if (row.direction === "down") tally.down = row.votes;
    }
    return result;
  }

  async listVoters(
    suggestionId: string,
  ): Promise<Array<{ userId: string; direction: VoteDirection; createdAt: Date }>> {
    const rows = await this.db
      .select()
      .from(suggestionVotes)
      .where(eq(suggestionVotes.suggestionId, suggestionId))
      .orderBy(asc(suggestionVotes.createdAt), asc(suggestionVotes.userId));
    return rows.map((r) => ({
      userId: r.userId,
      direction: r.direction as VoteDirection,
      createdAt: r.createdAt,
    }));
  }
}
