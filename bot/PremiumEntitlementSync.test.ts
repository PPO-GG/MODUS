import { describe, expect, it, vi } from "vitest";
import type { EntitlementInput } from "@modus/db";
import {
  fetchActiveGuildEntitlements,
  type EntitlementLike,
} from "./lib/entitlements";
import { PremiumEntitlementSync, type EntitlementStore } from "./PremiumEntitlementSync";

const SKU = "sku-premium";
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const ent = (over: Partial<EntitlementLike> = {}): EntitlementLike => ({
  id: "1",
  skuId: SKU,
  guildId: "g1",
  type: 8,
  deleted: false,
  startsAt: null,
  endsAt: null,
  ...over,
});

function fakeStore(activeIds: string[] = []) {
  const upserts: EntitlementInput[] = [];
  const deleted: string[] = [];
  const store: EntitlementStore = {
    upsert: async (i) => void upserts.push(i),
    markDeleted: async (id) => void deleted.push(id),
    listActiveIds: async () => [...activeIds],
  };
  return { store, upserts, deleted };
}

const make = (store: EntitlementStore, fetchActive: () => Promise<EntitlementLike[]>) =>
  new PremiumEntitlementSync({ skuId: SKU, store, fetchActive, logger });

describe("PremiumEntitlementSync event handlers", () => {
  it("upserts a guild entitlement for the configured SKU", async () => {
    const { store, upserts } = fakeStore();
    const e = ent({ endsAt: new Date("2026-11-01T00:00:00Z") });
    await make(store, async () => []).handleUpsert(e);
    expect(upserts).toEqual([
      {
        id: "1",
        guildId: "g1",
        skuId: SKU,
        type: 8,
        startsAt: null,
        endsAt: e.endsAt,
        deleted: false,
      },
    ]);
  });

  it("ignores other SKUs and user subscriptions (no guild)", async () => {
    const { store, upserts, deleted } = fakeStore();
    const sync = make(store, async () => []);
    await sync.handleUpsert(ent({ skuId: "other" }));
    await sync.handleUpsert(ent({ guildId: null }));
    await sync.handleDelete(ent({ skuId: "other" }));
    await sync.handleDelete(ent({ guildId: null }));
    expect(upserts).toEqual([]);
    expect(deleted).toEqual([]);
  });

  it("marks deleted on delete events", async () => {
    const { store, deleted } = fakeStore();
    await make(store, async () => []).handleDelete(ent({ id: "42" }));
    expect(deleted).toEqual(["42"]);
  });
});

describe("PremiumEntitlementSync.reconcile", () => {
  it("upserts what Discord reports and revokes active rows Discord no longer has", async () => {
    const { store, upserts, deleted } = fakeStore(["1", "stale"]);
    const result = await make(store, async () => [ent({ id: "1" }), ent({ id: "2" })]).reconcile();
    expect(upserts.map((u) => u.id)).toEqual(["1", "2"]);
    expect(deleted).toEqual(["stale"]);
    expect(result).toEqual({ upserted: 2, revoked: 1 });
  });

  it("never revokes anything when the Discord fetch fails", async () => {
    const { store, deleted } = fakeStore(["1", "2"]);
    const sync = make(store, async () => {
      throw new Error("discord 500");
    });
    await expect(sync.reconcile()).rejects.toThrow("discord 500");
    expect(deleted).toEqual([]);
  });

  it("does not revoke an entitlement created while the reconcile was running", async () => {
    const active = ["1"];
    const { store, deleted } = fakeStore(active);
    const sync = make(store, async () => {
      active.push("bought-mid-reconcile"); // entitlementCreate lands during the fetch
      return [ent({ id: "1" })];
    });
    await sync.reconcile();
    expect(deleted).toEqual([]);
  });

  it("skips entitlements without a guild but still counts them as seen", async () => {
    const { store, upserts, deleted } = fakeStore(["u1"]);
    await make(store, async () => [ent({ id: "u1", guildId: null })]).reconcile();
    expect(upserts).toEqual([]);
    expect(deleted).toEqual([]); // Discord still lists it, so it is not revoked
  });
});

describe("fetchActiveGuildEntitlements", () => {
  const page = (...ids: string[]) =>
    new Map(ids.map((id) => [id, ent({ id })]));

  it("pages with `after` until a short page and requests only live entitlements", async () => {
    const calls: any[] = [];
    const first = Array.from({ length: 100 }, (_, i) => String(1000 + i));
    const app = {
      entitlements: {
        fetch: async (o: any) => {
          calls.push(o);
          return o.after === undefined ? page(...first) : page("2000", "2001");
        },
      },
    };
    const all = await fetchActiveGuildEntitlements(app, SKU);
    expect(all).toHaveLength(102);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ skus: [SKU], excludeEnded: true, excludeDeleted: true, limit: 100 });
    expect(calls[1].after).toBe("1099");
  });

  it("rejects (rather than returning a partial list) if a full page adds nothing new", async () => {
    const same = Array.from({ length: 100 }, (_, i) => String(1000 + i));
    const app = { entitlements: { fetch: async () => page(...same) } };
    await expect(fetchActiveGuildEntitlements(app, SKU)).rejects.toThrow(/incomplete/i);
  });

  it("rejects when the page cap is hit before a short page", async () => {
    let next = 1;
    const app = {
      entitlements: {
        fetch: async () => page(...Array.from({ length: 100 }, () => String(next++))),
      },
    };
    await expect(fetchActiveGuildEntitlements(app, SKU)).rejects.toThrow(/incomplete/i);
  });
});
