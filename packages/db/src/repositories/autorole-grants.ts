/**
 * AutoroleGrantRepository — records which (member, rule) pairs the autoroles
 * module has already granted, so manual role removals are never undone.
 */
import { and, eq, notInArray } from "drizzle-orm";
import type { Database } from "../client";
import { autoroleGrants } from "../schema";

export class AutoroleGrantRepository {
  constructor(private db: Database) {}

  /** Returns true when this call inserted the row, false when it already existed. */
  async insertIfAbsent(guildId: string, userId: string, ruleId: string): Promise<boolean> {
    const rows = await this.db
      .insert(autoroleGrants)
      .values({ guildId, userId, ruleId })
      .onConflictDoNothing()
      .returning({ id: autoroleGrants.id });
    return rows.length > 0;
  }

  async delete(guildId: string, userId: string, ruleId: string): Promise<void> {
    await this.db
      .delete(autoroleGrants)
      .where(
        and(
          eq(autoroleGrants.guildId, guildId),
          eq(autoroleGrants.userId, userId),
          eq(autoroleGrants.ruleId, ruleId),
        ),
      );
  }

  async deleteByMember(guildId: string, userId: string): Promise<void> {
    await this.db
      .delete(autoroleGrants)
      .where(and(eq(autoroleGrants.guildId, guildId), eq(autoroleGrants.userId, userId)));
  }

  async deleteByRule(guildId: string, ruleId: string): Promise<void> {
    await this.db
      .delete(autoroleGrants)
      .where(and(eq(autoroleGrants.guildId, guildId), eq(autoroleGrants.ruleId, ruleId)));
  }

  /** Deletes the guild's grants whose rule id is not in `keepRuleIds`. Returns rows deleted. */
  async deleteRulesNotIn(guildId: string, keepRuleIds: string[]): Promise<number> {
    const where =
      keepRuleIds.length > 0
        ? and(eq(autoroleGrants.guildId, guildId), notInArray(autoroleGrants.ruleId, keepRuleIds))
        : eq(autoroleGrants.guildId, guildId);
    const rows = await this.db
      .delete(autoroleGrants)
      .where(where)
      .returning({ id: autoroleGrants.id });
    return rows.length;
  }

  async listGrantedUserIds(guildId: string, ruleId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ userId: autoroleGrants.userId })
      .from(autoroleGrants)
      .where(and(eq(autoroleGrants.guildId, guildId), eq(autoroleGrants.ruleId, ruleId)));
    return new Set(rows.map((r) => r.userId));
  }
}
