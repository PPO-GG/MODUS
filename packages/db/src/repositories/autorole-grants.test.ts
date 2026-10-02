import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb } from "../client";
import { autoroleGrants, xpUsers } from "../schema";
import { AutoroleGrantRepository } from "./autorole-grants";
import { XpUserRepository } from "./xp";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("AutoroleGrantRepository (integration)", () => {
  const { db, pool } = createDb({ url });
  const repo = new AutoroleGrantRepository(db);
  const xp = new XpUserRepository(db);
  const guildId = `test-${randomUUID()}`;

  afterAll(async () => {
    await db.delete(autoroleGrants).where(eq(autoroleGrants.guildId, guildId));
    await db.delete(xpUsers).where(eq(xpUsers.guildId, guildId));
    await pool.end();
  });

  it("insertIfAbsent is idempotent on (guild, user, rule)", async () => {
    expect(await repo.insertIfAbsent(guildId, "u1", "r1")).toBe(true);
    expect(await repo.insertIfAbsent(guildId, "u1", "r1")).toBe(false);
    expect(await repo.insertIfAbsent(guildId, "u1", "r2")).toBe(true);
  });

  it("insertIfAbsent lets only one of concurrent callers win", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => repo.insertIfAbsent(guildId, "u-race", "r1")),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("lists granted user ids per rule", async () => {
    await repo.insertIfAbsent(guildId, "u2", "r1");
    const granted = await repo.listGrantedUserIds(guildId, "r1");
    expect(granted.has("u1")).toBe(true);
    expect(granted.has("u2")).toBe(true);
    expect((await repo.listGrantedUserIds(guildId, "nope")).size).toBe(0);
  });

  it("delete removes a single grant", async () => {
    await repo.delete(guildId, "u1", "r2");
    expect((await repo.listGrantedUserIds(guildId, "r2")).has("u1")).toBe(false);
    expect((await repo.listGrantedUserIds(guildId, "r1")).has("u1")).toBe(true);
  });

  it("deleteByMember removes every grant for that member only", async () => {
    await repo.insertIfAbsent(guildId, "u3", "r1");
    await repo.insertIfAbsent(guildId, "u3", "r2");
    await repo.deleteByMember(guildId, "u3");
    expect((await repo.listGrantedUserIds(guildId, "r1")).has("u3")).toBe(false);
    expect((await repo.listGrantedUserIds(guildId, "r2")).has("u3")).toBe(false);
    expect((await repo.listGrantedUserIds(guildId, "r1")).has("u1")).toBe(true);
  });

  it("deleteByRule and deleteRulesNotIn remove whole rules", async () => {
    await repo.insertIfAbsent(guildId, "u4", "r-gone");
    await repo.insertIfAbsent(guildId, "u4", "r-keep");
    const deleted = await repo.deleteRulesNotIn(guildId, ["r1", "r2", "r-keep"]);
    expect(deleted).toBe(1);
    expect((await repo.listGrantedUserIds(guildId, "r-gone")).size).toBe(0);
    expect((await repo.listGrantedUserIds(guildId, "r-keep")).has("u4")).toBe(true);
    await repo.deleteByRule(guildId, "r-keep");
    expect((await repo.listGrantedUserIds(guildId, "r-keep")).size).toBe(0);
  });

  it("deleteRulesNotIn with an empty keep-list deletes all of the guild's grants", async () => {
    await repo.insertIfAbsent(guildId, "u5", "r9");
    await repo.deleteRulesNotIn(guildId, []);
    expect((await repo.listGrantedUserIds(guildId, "r9")).size).toBe(0);
    expect((await repo.listGrantedUserIds(guildId, "r1")).size).toBe(0);
  });

  it("XpUserRepository.listOptedInLevels filters by level and opt-in", async () => {
    await xp.create({ guild_id: guildId, user_id: "x1", username: "a", level: 5, opted_in: true });
    await xp.create({ guild_id: guildId, user_id: "x2", username: "b", level: 2, opted_in: true });
    await xp.create({ guild_id: guildId, user_id: "x3", username: "c", level: 9, opted_in: false });
    const rows = await xp.listOptedInLevels(guildId, 3);
    expect(rows).toEqual([{ userId: "x1", level: 5 }]);
    const all = await xp.listOptedInLevels(guildId, 0);
    expect(all.map((r) => r.userId).sort()).toEqual(["x1", "x2"]);
  });
});
