/**
 * ServerRepository — guild metadata + premium flag + admin/dashboard ACLs.
 */
import { and, asc, count, eq, inArray, or, sql } from "drizzle-orm";
import { requireReturningRow } from "../client";
import type { Database } from "../client";
import { guildEntitlements, servers, type Server } from "../schema";
import {
  activeEntitlementEndsAt,
  entitlementIsLive,
  hasActiveEntitlement,
} from "./guild-entitlements";

export type ServerDoc = Server & {
  $id: string;
  guild_id: string;
  member_count: number | null;
  shard_id: number | null;
  last_checked: string | null;
  is_public: boolean;
  invite_link: string | null;
  owner_id: string | null;
  admin_user_ids: string[];
  dashboard_role_ids: string[];
};

function toDoc(row: Server): ServerDoc {
  return {
    ...row,
    // Appwrite-era contract: the web frontend treats `$id` as the Discord
    // guild ID (routes, icon URLs, isInSystem checks). Post-migration rows
    // have a UUID primary key, so `$id` must map to guild_id, not row.id.
    $id: row.guildId,
    guild_id: row.guildId,
    member_count: row.memberCount,
    shard_id: row.shardId,
    last_checked: row.lastChecked ? row.lastChecked.toISOString() : null,
    is_public: row.isPublic,
    invite_link: row.inviteLink,
    owner_id: row.ownerId,
    admin_user_ids: row.adminUserIds ?? [],
    dashboard_role_ids: row.dashboardRoleIds ?? [],
  };
}

export type PremiumSource = "manual" | "subscription" | "both" | null;

export interface PremiumStatus {
  premium: boolean;
  source: PremiumSource;
  subscriptionEndsAt: Date | null;
}

export function derivePremiumSource(
  manual: boolean,
  subscribed: boolean,
): PremiumSource {
  if (manual && subscribed) return "both";
  if (manual) return "manual";
  if (subscribed) return "subscription";
  return null;
}

/** ServerDoc plus effective-premium fields. `premium` stays the raw manual flag. */
export type ServerDocWithPremium = ServerDoc & {
  effective_premium: boolean;
  premium_source: PremiumSource;
  subscription_ends_at: string | null;
};

type PremiumRow = {
  server: Server;
  subscribed: boolean;
  subscriptionEndsAt: Date | null;
};

function toPremiumDoc(r: PremiumRow): ServerDocWithPremium {
  const manual = r.server.premium === true;
  return {
    ...toDoc(r.server),
    effective_premium: manual || r.subscribed,
    premium_source: derivePremiumSource(manual, r.subscribed),
    subscription_ends_at:
      r.subscribed && r.subscriptionEndsAt
        ? r.subscriptionEndsAt.toISOString()
        : null,
  };
}

/** Extra select columns carrying subscription state for a `servers` query. */
function premiumColumns() {
  return {
    subscribed: hasActiveEntitlement(servers.guildId).mapWith(Boolean),
    subscriptionEndsAt: activeEntitlementEndsAt(servers.guildId),
  };
}

/** Structural executor type so audited mutations can pass a transaction. */
export type ServerExecutor = Pick<Database, "select" | "insert" | "update" | "delete">;

export class ServerRepository {
  constructor(private db: ServerExecutor) {}

  async listAll(): Promise<ServerDoc[]> {
    const rows = await this.db.select().from(servers);
    return rows.map(toDoc);
  }

  /**
   * Filtered page + total count for the admin servers table.
   * Omitted filters are not applied; `status` maps onto the boolean
   * `status` column. Ordered by lowercased name to match the sort the
   * dashboard previously did client-side.
   */
  async listPage(opts: {
    status?: "online" | "offline";
    premium?: boolean;
    offset: number;
    limit: number;
  }): Promise<{ rows: ServerDocWithPremium[]; total: number }> {
    const conditions = [];
    if (opts.status) {
      conditions.push(eq(servers.status, opts.status === "online"));
    }
    if (opts.premium !== undefined) {
      // Effective premium: manual flag OR an active Discord subscription.
      const effective = sql`(${servers.premium} or ${hasActiveEntitlement(servers.guildId)})`;
      conditions.push(opts.premium ? effective : sql`not ${effective}`);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalRows] = await Promise.all([
      this.db
        .select({ server: servers, ...premiumColumns() })
        .from(servers)
        .where(where)
        .orderBy(asc(sql`lower(${servers.name})`), asc(servers.id))
        .limit(opts.limit)
        .offset(opts.offset),
      this.db.select({ c: count() }).from(servers).where(where),
    ]);
    return { rows: rows.map(toPremiumDoc), total: totalRows[0]?.c ?? 0 };
  }

  async getByGuildId(guildId: string): Promise<ServerDoc | null> {
    const rows = await this.db
      .select()
      .from(servers)
      .where(eq(servers.guildId, guildId))
      .limit(1);
    return rows[0] ? toDoc(rows[0]) : null;
  }

  /**
   * Upsert a server row keyed on `guild_id`. Used by guildCreate /
   * periodic reconciliation to register guilds the bot is in but that
   * were never explicitly added via the dashboard. Never overwrites
   * owner/admin ACLs — those are dashboard-managed.
   */
  async upsertByGuildId(input: {
    guildId: string;
    name: string;
    icon: string | null;
    memberCount: number;
    status: boolean;
    shardId: number;
    ownerId?: string | null;
  }): Promise<void> {
    await this.db
      .insert(servers)
      .values({
        guildId: input.guildId,
        name: input.name,
        icon: input.icon,
        memberCount: input.memberCount,
        status: input.status,
        shardId: input.shardId,
        ownerId: input.ownerId ?? null,
        lastChecked: new Date(),
      })
      .onConflictDoUpdate({
        target: servers.guildId,
        set: {
          name: input.name,
          icon: input.icon,
          memberCount: input.memberCount,
          status: input.status,
          shardId: input.shardId,
          lastChecked: new Date(),
        },
      });
  }

  /** Mark a server offline (bot left or guild deleted). Row is kept so
   *  guild_configs and history remain intact. */
  async markOffline(guildId: string): Promise<void> {
    await this.db
      .update(servers)
      .set({ status: false, shardId: null, lastChecked: new Date() })
      .where(eq(servers.guildId, guildId));
  }

  /** Effective premium: the manual flag OR an active Discord subscription. */
  async isPremium(guildId: string): Promise<boolean> {
    return (await this.getPremiumStatus(guildId)).premium;
  }

  /** The raw admin-granted flag only (what the admin toggle and its audit trail control). */
  async isManualPremium(guildId: string): Promise<boolean> {
    const row = await this.getByGuildId(guildId);
    return row?.premium === true;
  }

  async getPremiumStatus(guildId: string): Promise<PremiumStatus> {
    // Two plain queries rather than a join: a subscribed guild may not have a
    // servers row yet (entitlement can predate the bot joining).
    const [server] = await this.db
      .select({ premium: servers.premium })
      .from(servers)
      .where(eq(servers.guildId, guildId))
      .limit(1);
    const [sub] = await this.db
      .select({
        n: count(),
        endsAt: sql<Date | null>`max(${guildEntitlements.endsAt})`.mapWith(
          guildEntitlements.endsAt,
        ),
      })
      .from(guildEntitlements)
      .where(and(eq(guildEntitlements.guildId, guildId), entitlementIsLive()));

    const manual = server?.premium === true;
    const subscribed = (sub?.n ?? 0) > 0;
    return {
      premium: manual || subscribed,
      source: derivePremiumSource(manual, subscribed),
      subscriptionEndsAt: subscribed ? (sub?.endsAt ?? null) : null,
    };
  }

  async setPremium(guildId: string, premium: boolean): Promise<void> {
    await this.db
      .update(servers)
      .set({ premium })
      .where(eq(servers.guildId, guildId));
  }

  /** Total count of registered servers — used for the public stats page. */
  async countAll(): Promise<number> {
    const [row] = await this.db.select({ c: count() }).from(servers);
    return row?.c ?? 0;
  }

  /** Fleet counts for the admin operations overview. */
  async getAdminCounts(since: Date): Promise<{
    total: number;
    online: number;
    offline: number;
    premium: number;
    registeredSince: number;
  }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        online: sql<number>`count(*) filter (where ${servers.status})::int`,
        offline: sql<number>`count(*) filter (where not ${servers.status})::int`,
        premium: sql<number>`count(*) filter (where ${servers.premium} or ${hasActiveEntitlement(servers.guildId)})::int`,
        registeredSince: sql<number>`count(*) filter (where ${servers.createdAt} >= ${since})::int`,
      })
      .from(servers);

    return {
      total: row?.total ?? 0,
      online: row?.online ?? 0,
      offline: row?.offline ?? 0,
      premium: row?.premium ?? 0,
      registeredSince: row?.registeredSince ?? 0,
    };
  }

  /**
   * Servers where the user is the owner or appears in `admin_user_ids`.
   * Backs GET /api/servers/my-servers.
   */
  async listOwnedOrAdminBy(userId: string): Promise<ServerDoc[]> {
    const rows = await this.db
      .select()
      .from(servers)
      .where(
        or(
          eq(servers.ownerId, userId),
          sql`${userId} = ANY(${servers.adminUserIds})`,
        ),
      )
      .limit(400);
    return rows.map(toDoc);
  }

  /**
   * Batch lookup by guild_id. Preserves the Appwrite-era response shape
   * used by the Discover page (trims to a small public projection).
   */
  async listByGuildIds(guildIds: string[]): Promise<ServerDocWithPremium[]> {
    if (guildIds.length === 0) return [];
    const rows = await this.db
      .select({ server: servers, ...premiumColumns() })
      .from(servers)
      .where(inArray(servers.guildId, guildIds));
    return rows.map(toPremiumDoc);
  }

  /**
   * Register a new server with the caller as owner + initial admin.
   * Throws a tagged error on duplicate guild_id so the endpoint can
   * return 409 without sniffing Postgres error codes.
   */
  async createForGuild(data: {
    guild_id: string;
    name: string;
    icon?: string | null;
    owner_id: string;
    admin_user_ids?: string[];
  }): Promise<ServerDoc> {
    // Pre-check keeps the happy path readable; the unique index is still
    // the source of truth if two creates race.
    const existing = await this.getByGuildId(data.guild_id);
    if (existing) {
      const err = new Error(
        `Server for guild ${data.guild_id} already exists.`,
      ) as Error & { code: "DUPLICATE_SERVER" };
      err.code = "DUPLICATE_SERVER";
      throw err;
    }

    try {
      const [row] = await this.db
        .insert(servers)
        .values({
          guildId: data.guild_id,
          name: data.name,
          icon: data.icon ?? null,
          ownerId: data.owner_id,
          adminUserIds: data.admin_user_ids ?? [data.owner_id],
          status: false,
          lastChecked: new Date(),
        })
        .returning();
      return toDoc(requireReturningRow(row, "Server insert"));
    } catch (err: any) {
      // Unique index on guild_id — race between the pre-check and insert.
      if (err?.code === "23505") {
        const e = new Error(
          `Server for guild ${data.guild_id} already exists.`,
        ) as Error & { code: "DUPLICATE_SERVER" };
        e.code = "DUPLICATE_SERVER";
        throw e;
      }
      throw err;
    }
  }

  /**
   * Atomically append `userId` to `admin_user_ids` iff not already present.
   * Returns the updated row, or null when no server exists for the guild.
   */
  async addAdmin(
    guildId: string,
    userId: string,
  ): Promise<{ server: ServerDoc; wasAlreadyAdmin: boolean } | null> {
    const existing = await this.getByGuildId(guildId);
    if (!existing) return null;
    if (existing.admin_user_ids.includes(userId)) {
      return { server: existing, wasAlreadyAdmin: true };
    }
    const [row] = await this.db
      .update(servers)
      .set({
        adminUserIds: sql`array_append(${servers.adminUserIds}, ${userId})`,
      })
      .where(eq(servers.guildId, guildId))
      .returning();
    return {
      server: toDoc(requireReturningRow(row, "Server admin update")),
      wasAlreadyAdmin: false,
    };
  }

  /**
   * Replace the dashboard_role_ids array on a server. Caller is
   * responsible for ACL validation.
   */
  async updateDashboardRoles(
    guildId: string,
    roleIds: string[],
  ): Promise<ServerDoc | null> {
    const [row] = await this.db
      .update(servers)
      .set({ dashboardRoleIds: roleIds })
      .where(eq(servers.guildId, guildId))
      .returning();
    return row ? toDoc(row) : null;
  }

  /** Delete a server row by guild_id. */
  async deleteByGuildId(guildId: string): Promise<void> {
    await this.db.delete(servers).where(eq(servers.guildId, guildId));
  }

  async upsertMigrated(input: {
    id: string;
    guild_id: string;
    name: string;
    icon?: string | null;
    owner_id?: string | null;
    member_count?: number | null;
    status?: boolean;
    ping?: number | null;
    shard_id?: number | null;
    last_checked?: string | null;
    is_public?: boolean;
    description?: string | null;
    invite_link?: string | null;
    premium?: boolean;
    admin_user_ids?: string[];
    dashboard_role_ids?: string[];
    createdAt?: string | Date;
  }): Promise<void> {
    await this.db
      .insert(servers)
      .values({
        id: input.id,
        guildId: input.guild_id,
        name: input.name,
        icon: input.icon ?? null,
        ownerId: input.owner_id ?? null,
        memberCount: input.member_count ?? null,
        status: input.status ?? false,
        ping: input.ping ?? null,
        shardId: input.shard_id ?? null,
        lastChecked: input.last_checked ? new Date(input.last_checked) : null,
        isPublic: input.is_public ?? false,
        description: input.description ?? null,
        inviteLink: input.invite_link ?? null,
        premium: input.premium ?? false,
        adminUserIds: input.admin_user_ids ?? [],
        dashboardRoleIds: input.dashboard_role_ids ?? [],
        ...(input.createdAt
          ? {
              createdAt:
                input.createdAt instanceof Date
                  ? input.createdAt
                  : new Date(input.createdAt),
            }
          : {}),
      })
      .onConflictDoNothing({ target: servers.id });
  }
}
