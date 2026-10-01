/**
 * GuildEntitlementRepository — Discord guild-subscription entitlements for the
 * Modus Premium SKU. Premium is derived from these rows plus `servers.premium`
 * (see ServerRepository.getPremiumStatus).
 */
import { and, count, eq, getTableName, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { Database } from "../client";
import { guildEntitlements } from "../schema";

export interface EntitlementInput {
  id: string;
  guildId: string;
  skuId: string;
  type: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  deleted: boolean;
}

/** JS mirror of {@link entitlementIsLive}; keep the two in sync. */
export function isEntitlementActive(
  e: { deleted: boolean; startsAt: Date | null; endsAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (e.deleted) return false;
  if (e.startsAt && e.startsAt.getTime() > now.getTime()) return false;
  if (e.endsAt && e.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

/** SQL: the entitlement row is active right now. */
export function entitlementIsLive(): SQL {
  return sql`(${guildEntitlements.deleted} = false and (${guildEntitlements.startsAt} is null or ${guildEntitlements.startsAt} <= now()) and (${guildEntitlements.endsAt} is null or ${guildEntitlements.endsAt} > now()))`;
}

/**
 * Explicitly table-qualified column reference. drizzle drops qualifiers for
 * columns inside a single-table select list, which would turn the correlated
 * `guild_id = guild_id` below into a self-comparison that is always true.
 */
function qualified(column: AnyPgColumn): SQL {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}

/** Correlated subquery: does the guild in `guildIdColumn` have an active entitlement? */
export function hasActiveEntitlement(guildIdColumn: AnyPgColumn): SQL<boolean> {
  return sql<boolean>`exists (select 1 from ${guildEntitlements} where ${qualified(guildEntitlements.guildId)} = ${qualified(guildIdColumn)} and ${entitlementIsLive()})`;
}

/** Correlated subquery: latest `ends_at` among the guild's active entitlements (null if none/open-ended). */
export function activeEntitlementEndsAt(
  guildIdColumn: AnyPgColumn,
): SQL<Date | null> {
  return sql<Date | null>`(select max(${guildEntitlements.endsAt}) from ${guildEntitlements} where ${qualified(guildEntitlements.guildId)} = ${qualified(guildIdColumn)} and ${entitlementIsLive()})`.mapWith(
    guildEntitlements.endsAt,
  );
}

export type GuildEntitlementExecutor = Pick<
  Database,
  "select" | "insert" | "update" | "delete"
>;

export class GuildEntitlementRepository {
  constructor(private db: GuildEntitlementExecutor) {}

  async upsert(input: EntitlementInput): Promise<void> {
    const values = {
      guildId: input.guildId,
      skuId: input.skuId,
      type: input.type,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      deleted: input.deleted,
    };
    await this.db
      .insert(guildEntitlements)
      .values({ id: input.id, ...values })
      .onConflictDoUpdate({
        target: guildEntitlements.id,
        set: { ...values, updatedAt: new Date() },
      });
  }

  /** Mark an entitlement deleted. Unknown ids are a no-op. */
  async markDeleted(id: string): Promise<void> {
    await this.db
      .update(guildEntitlements)
      .set({ deleted: true, updatedAt: new Date() })
      .where(eq(guildEntitlements.id, id));
  }

  /** Ids of entitlements for `skuId` that are active right now. */
  async listActiveIds(skuId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: guildEntitlements.id })
      .from(guildEntitlements)
      .where(and(eq(guildEntitlements.skuId, skuId), entitlementIsLive()));
    return rows.map((r) => r.id);
  }

  async hasActive(guildId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ c: count() })
      .from(guildEntitlements)
      .where(and(eq(guildEntitlements.guildId, guildId), entitlementIsLive()));
    return (row?.c ?? 0) > 0;
  }
}
