/**
 * Helpers for mirroring Discord entitlements into Postgres. The structural
 * `EntitlementLike` type keeps the sync logic testable without discord.js.
 */
import type { EntitlementInput } from "@modus/db";

export interface EntitlementLike {
  id: string;
  skuId: string;
  guildId: string | null;
  type: number;
  deleted: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

export function toEntitlementInput(
  e: EntitlementLike,
  guildId: string,
): EntitlementInput {
  return {
    id: e.id,
    guildId,
    skuId: e.skuId,
    type: e.type,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    deleted: e.deleted,
  };
}

export interface EntitlementFetcher {
  entitlements: {
    fetch(options: {
      skus: string[];
      excludeEnded: boolean;
      excludeDeleted: boolean;
      limit: number;
      after?: string;
      cache: boolean;
    }): Promise<ReadonlyMap<string, EntitlementLike>>;
  };
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

/**
 * Every live (not ended, not deleted) entitlement for the SKU. Throws unless
 * the listing is provably complete (it ends on a short page): callers revoke
 * whatever is missing from this list, so a truncated list must never be
 * returned as if it were whole.
 */
export async function fetchActiveGuildEntitlements(
  app: EntitlementFetcher,
  skuId: string,
): Promise<EntitlementLike[]> {
  const byId = new Map<string, EntitlementLike>();
  let after: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const batch = await app.entitlements.fetch({
      skus: [skuId],
      excludeEnded: true,
      excludeDeleted: true,
      limit: PAGE_SIZE,
      after,
      cache: false,
    });
    let added = 0;
    let newest = after;
    for (const e of batch.values()) {
      if (!byId.has(e.id)) added++;
      byId.set(e.id, e);
      if (newest === undefined || BigInt(e.id) > BigInt(newest)) newest = e.id;
    }
    if (batch.size < PAGE_SIZE) return [...byId.values()];
    if (added === 0) {
      throw new Error("Entitlement listing incomplete: full page added nothing new");
    }
    after = newest;
  }
  throw new Error(`Entitlement listing incomplete: exceeded ${MAX_PAGES} pages`);
}
