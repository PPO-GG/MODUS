import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb } from "../client";
import { moderationCases } from "../schema";
import { ModerationCaseRepository } from "./moderation-cases";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("ModerationCaseRepository (integration)", () => {
  const { db, pool } = createDb({ url });
  const repo = new ModerationCaseRepository(db);
  const guildId = `test-${randomUUID()}`;
  const base = { guildId, action: "ban" as const, targetId: "1", targetTag: "t#1", source: "command" as const };

  afterAll(async () => {
    await db.delete(moderationCases).where(eq(moderationCases.guildId, guildId));
    await pool.end();
  });

  it("numbers cases per guild, starting after the seed", async () => {
    const a = await repo.create({ ...base, seed: 41 });
    const b = await repo.create({ ...base, seed: 41 });
    expect(a.caseNumber).toBe(42);
    expect(b.caseNumber).toBe(43);
  });

  it("gives concurrent inserts distinct numbers", async () => {
    const rows = await Promise.all(Array.from({ length: 5 }, () => repo.create({ ...base })));
    const numbers = rows.map((r) => r.caseNumber).sort((x, y) => x - y);
    expect(new Set(numbers).size).toBe(5);
    expect(numbers[4] - numbers[0]).toBe(4);
  });

  it("lists newest first with a before cursor and counts by action", async () => {
    await repo.create({ ...base, action: "warn" });
    const recent = await repo.listRecent(guildId, { limit: 3 });
    expect(recent).toHaveLength(3);
    expect(recent[0].caseNumber).toBeGreaterThan(recent[1].caseNumber);
    const older = await repo.listRecent(guildId, { limit: 50, before: recent[2].caseNumber });
    expect(older.every((r) => r.caseNumber < recent[2].caseNumber)).toBe(true);
    const counts = await repo.countsSince(guildId, new Date(Date.now() - 60_000));
    expect(counts.ban).toBe(7);
    expect(counts.warn).toBe(1);
  });

  it("insertIfAbsent is idempotent on (guild, case number)", async () => {
    const input = { ...base, action: "warn" as const, caseNumber: 1000 };
    expect(await repo.insertIfAbsent(input)).toBe(true);
    expect(await repo.insertIfAbsent(input)).toBe(false);
  });
});
