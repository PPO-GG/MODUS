import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { createDb } from "../client";
import { guildEntitlements } from "../schema";
import {
  GuildEntitlementRepository,
  isEntitlementActive,
} from "./guild-entitlements";

const NOW = new Date("2026-10-01T12:00:00Z");
const hour = 60 * 60 * 1000;

describe("isEntitlementActive", () => {
  const base = { deleted: false, startsAt: null, endsAt: null };

  it("treats an open-ended entitlement as active", () => {
    expect(isEntitlementActive(base, NOW)).toBe(true);
  });
  it("is inactive once deleted", () => {
    expect(isEntitlementActive({ ...base, deleted: true }, NOW)).toBe(false);
  });
  it("stays active until ends_at, then lapses", () => {
    const endsAt = new Date(NOW.getTime() + hour);
    expect(isEntitlementActive({ ...base, endsAt }, NOW)).toBe(true);
    expect(isEntitlementActive({ ...base, endsAt: NOW }, NOW)).toBe(false);
    expect(
      isEntitlementActive({ ...base, endsAt: new Date(NOW.getTime() - hour) }, NOW),
    ).toBe(false);
  });
  it("is inactive before starts_at", () => {
    const startsAt = new Date(NOW.getTime() + hour);
    expect(isEntitlementActive({ ...base, startsAt }, NOW)).toBe(false);
    expect(isEntitlementActive({ ...base, startsAt: NOW }, NOW)).toBe(true);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("GuildEntitlementRepository (integration)", () => {
  const { db, pool } = createDb({ url });
  const repo = new GuildEntitlementRepository(db);
  const sku = `sku-${randomUUID()}`;
  const guildId = `test-${randomUUID()}`;
  const ids: string[] = [];
  const mk = (over: Partial<Parameters<typeof repo.upsert>[0]> = {}) => {
    const id = `ent-${randomUUID()}`;
    ids.push(id);
    return { id, guildId, skuId: sku, type: 8, startsAt: null, endsAt: null, deleted: false, ...over };
  };

  afterAll(async () => {
    await db.delete(guildEntitlements).where(inArray(guildEntitlements.id, ids));
    await pool.end();
  });

  it("upserts idempotently and updates in place", async () => {
    const e = mk();
    await repo.upsert(e);
    await repo.upsert({ ...e, endsAt: new Date(Date.now() + 86_400_000) });
    expect(await repo.hasActive(guildId)).toBe(true);
    expect((await repo.listActiveIds(sku)).filter((i) => i === e.id)).toHaveLength(1);
  });

  it("markDeleted removes it from the active set; unknown ids are a no-op", async () => {
    const e = mk();
    await repo.upsert(e);
    await repo.markDeleted(e.id);
    expect(await repo.listActiveIds(sku)).not.toContain(e.id);
    await expect(repo.markDeleted(`missing-${randomUUID()}`)).resolves.toBeUndefined();
  });

  it("listActiveIds is scoped to the SKU and excludes ended entitlements", async () => {
    const other = mk({ skuId: `other-${randomUUID()}` });
    const ended = mk({ endsAt: new Date(Date.now() - 1000) });
    await repo.upsert(other);
    await repo.upsert(ended);
    const active = await repo.listActiveIds(sku);
    expect(active).not.toContain(other.id);
    expect(active).not.toContain(ended.id);
  });
});
