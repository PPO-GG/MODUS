import { and, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { requireReturningRow } from "../client";
import type { Database } from "../client";
import { moderationCases, type ModerationCaseRow } from "../schema";

export type ModerationAction = "warn" | "kick" | "ban" | "unban" | "timeout" | "untimeout" | "purge";
export const MODERATION_ACTIONS: ModerationAction[] = ["warn", "kick", "ban", "unban", "timeout", "untimeout", "purge"];

export interface CreateModerationCaseInput {
  guildId: string;
  action: ModerationAction;
  targetId: string;
  targetTag: string;
  moderatorId?: string | null;
  moderatorTag?: string | null;
  reason?: string | null;
  durationMinutes?: number | null;
  source: "command" | "discord";
  createdAt?: Date;
  /** Legacy settings.lastCaseId — numbering continues after it. */
  seed?: number;
}

function isUniqueViolation(err: any): boolean {
  return err?.code === "23505" || err?.cause?.code === "23505";
}

export class ModerationCaseRepository {
  constructor(private db: Database) {}

  /** Insert a case; its number is assigned in the INSERT (max+1, at least seed+1). */
  async create(input: CreateModerationCaseInput): Promise<ModerationCaseRow> {
    const seed = input.seed ?? 0;
    for (let attempt = 0; ; attempt++) {
      try {
        const [row] = await this.db
          .insert(moderationCases)
          .values({
            guildId: input.guildId,
            caseNumber: sql`(select greatest(coalesce(max(${moderationCases.caseNumber}), 0), ${seed}) + 1 from ${moderationCases} where ${moderationCases.guildId} = ${input.guildId})`,
            action: input.action,
            targetId: input.targetId,
            targetTag: input.targetTag,
            moderatorId: input.moderatorId ?? null,
            moderatorTag: input.moderatorTag ?? null,
            reason: input.reason ?? null,
            durationMinutes: input.durationMinutes ?? null,
            source: input.source,
            ...(input.createdAt ? { createdAt: input.createdAt } : {}),
          })
          .returning();
        return requireReturningRow(row, "Moderation case insert");
      } catch (err) {
        if (isUniqueViolation(err) && attempt < 5) continue;
        throw err;
      }
    }
  }

  /** Backfill helper: insert with an explicit number; false if it already exists. */
  async insertIfAbsent(input: CreateModerationCaseInput & { caseNumber: number }): Promise<boolean> {
    const rows = await this.db
      .insert(moderationCases)
      .values({
        guildId: input.guildId,
        caseNumber: input.caseNumber,
        action: input.action,
        targetId: input.targetId,
        targetTag: input.targetTag,
        moderatorId: input.moderatorId ?? null,
        moderatorTag: input.moderatorTag ?? null,
        reason: input.reason ?? null,
        durationMinutes: input.durationMinutes ?? null,
        source: input.source,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      })
      .onConflictDoNothing({ target: [moderationCases.guildId, moderationCases.caseNumber] })
      .returning({ id: moderationCases.id });
    return rows.length > 0;
  }

  async listRecent(guildId: string, opts: { limit: number; before?: number }): Promise<ModerationCaseRow[]> {
    const conditions = [eq(moderationCases.guildId, guildId)];
    if (opts.before !== undefined) conditions.push(lt(moderationCases.caseNumber, opts.before));
    return await this.db
      .select()
      .from(moderationCases)
      .where(and(...conditions))
      .orderBy(desc(moderationCases.caseNumber))
      .limit(opts.limit);
  }

  async countsSince(guildId: string, since: Date): Promise<Partial<Record<ModerationAction, number>>> {
    const rows = await this.db
      .select({ action: moderationCases.action, n: count() })
      .from(moderationCases)
      .where(and(eq(moderationCases.guildId, guildId), gte(moderationCases.createdAt, since)))
      .groupBy(moderationCases.action);
    const out: Partial<Record<ModerationAction, number>> = {};
    for (const r of rows) out[r.action as ModerationAction] = Number(r.n);
    return out;
  }
}
