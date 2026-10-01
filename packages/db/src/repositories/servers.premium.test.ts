import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { createDb } from "../client";
import { guildEntitlements, servers } from "../schema";
import { GuildEntitlementRepository } from "./guild-entitlements";
import { derivePremiumSource, ServerRepository } from "./servers";

describe("derivePremiumSource", () => {
  it("maps the four combinations", () => {
    expect(derivePremiumSource(false, false)).toBeNull();
    expect(derivePremiumSource(true, false)).toBe("manual");
    expect(derivePremiumSource(false, true)).toBe("subscription");
    expect(derivePremiumSource(true, true)).toBe("both");
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("ServerRepository effective premium (integration)", () => {
  const { db, pool } = createDb({ url });
  const repo = new ServerRepository(db);
  const ents = new GuildEntitlementRepository(db);
  const sku = `sku-${randomUUID()}`;
  const guildIds: string[] = [];
  const entIds: string[] = [];

  const guild = () => {
    const g = `test-${randomUUID()}`;
    guildIds.push(g);
    return g;
  };
  const addServer = async (guildId: string, premium = false) => {
    await db.insert(servers).values({ guildId, name: "Test", premium });
  };
  const addEnt = async (
    guildId: string,
    over: Partial<Parameters<typeof ents.upsert>[0]> = {},
  ) => {
    const id = `ent-${randomUUID()}`;
    entIds.push(id);
    await ents.upsert({
      id,
      guildId,
      skuId: sku,
      type: 8,
      startsAt: null,
      endsAt: null,
      deleted: false,
      ...over,
    });
  };

  afterAll(async () => {
    await db.delete(guildEntitlements).where(inArray(guildEntitlements.id, entIds));
    await db.delete(servers).where(inArray(servers.guildId, guildIds));
    await pool.end();
  });

  it("is free with neither a manual grant nor a subscription", async () => {
    const g = guild();
    await addServer(g);
    expect(await repo.isPremium(g)).toBe(false);
    expect(await repo.getPremiumStatus(g)).toEqual({
      premium: false,
      source: null,
      subscriptionEndsAt: null,
    });
  });

  it("reports manual, subscription and both sources", async () => {
    const manual = guild();
    await addServer(manual, true);
    const sub = guild();
    await addServer(sub);
    await addEnt(sub);
    const both = guild();
    await addServer(both, true);
    await addEnt(both);

    expect((await repo.getPremiumStatus(manual)).source).toBe("manual");
    expect((await repo.getPremiumStatus(sub)).source).toBe("subscription");
    expect((await repo.getPremiumStatus(both)).source).toBe("both");
    expect(await repo.isPremium(sub)).toBe(true);
  });

  it("keeps a cancelled subscription active until ends_at, then lapses", async () => {
    const future = guild();
    await addServer(future);
    const endsAt = new Date(Date.now() + 3 * 86_400_000);
    await addEnt(future, { endsAt });
    const status = await repo.getPremiumStatus(future);
    expect(status.premium).toBe(true);
    expect(status.subscriptionEndsAt?.getTime()).toBe(endsAt.getTime());

    const past = guild();
    await addServer(past);
    await addEnt(past, { endsAt: new Date(Date.now() - 1000) });
    expect(await repo.isPremium(past)).toBe(false);

    const gone = guild();
    await addServer(gone);
    await addEnt(gone, { deleted: true });
    expect(await repo.isPremium(gone)).toBe(false);
  });

  it("treats a subscribed guild with no servers row as premium", async () => {
    const g = guild();
    await addEnt(g);
    expect(await repo.isPremium(g)).toBe(true);
    expect((await repo.getPremiumStatus(g)).source).toBe("subscription");
  });

  it("isManualPremium ignores subscriptions", async () => {
    const g = guild();
    await addServer(g);
    await addEnt(g);
    expect(await repo.isManualPremium(g)).toBe(false);
    expect(await repo.isPremium(g)).toBe(true);
  });

  it("listPage premium filter and listByGuildIds use effective premium", async () => {
    const subscribed = guild();
    await addServer(subscribed);
    await addEnt(subscribed);
    const free = guild();
    await addServer(free);

    const premiumPage = await repo.listPage({ premium: true, offset: 0, limit: 100 });
    const ids = premiumPage.rows.map((r) => r.guild_id);
    expect(ids).toContain(subscribed);
    expect(ids).not.toContain(free);

    const docs = await repo.listByGuildIds([subscribed, free]);
    const sub = docs.find((d) => d.guild_id === subscribed)!;
    expect(sub.premium).toBe(false); // raw manual flag untouched
    expect(sub.effective_premium).toBe(true);
    expect(sub.premium_source).toBe("subscription");
    expect(docs.find((d) => d.guild_id === free)!.effective_premium).toBe(false);
  });

  it("getAdminCounts counts subscribed guilds as premium", async () => {
    const since = new Date(0);
    const before = (await repo.getAdminCounts(since)).premium;
    const g = guild();
    await addServer(g);
    await addEnt(g);
    expect((await repo.getAdminCounts(since)).premium).toBe(before + 1);
  });
});
