import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { createDb } from "../client";
import { suggestions } from "../schema";
import { SuggestionRepository } from "./suggestions";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("SuggestionRepository (integration)", () => {
  const { db, pool } = createDb({ url });
  const repo = new SuggestionRepository(db);
  const guildId = `test-${randomUUID()}`;
  const otherGuild = `${guildId}-other`;
  const make = (over: Partial<Parameters<SuggestionRepository["create"]>[0]> = {}) =>
    repo.create({ guildId, authorId: "u1", title: "Title", body: "Body", ...over });

  // Guilds created inline by individual tests; cleaned in afterAll so a failing
  // assertion cannot leak rows.
  const extraGuilds: string[] = [];
  const extraGuild = (suffix: string) => {
    const g = `${guildId}-${suffix}`;
    extraGuilds.push(g);
    return g;
  };

  afterAll(async () => {
    await db
      .delete(suggestions)
      .where(inArray(suggestions.guildId, [guildId, otherGuild, ...extraGuilds]));
    await pool.end();
  });

  it("assigns sequential per-guild numbers starting at 1 with status pending", async () => {
    const a = await make();
    const b = await make();
    const other = await make({ guildId: otherGuild });
    expect([a.number, b.number]).toEqual([1, 2]);
    expect(other.number).toBe(1);
    expect(a.status).toBe("pending");
    expect(a.channelId).toBeNull();
  });

  it("never duplicates or skips numbers under concurrent creates", async () => {
    const g = extraGuild("race");
    const rows = await Promise.all(
      Array.from({ length: 8 }, () => repo.create({ guildId: g, authorId: "u", title: "t", body: "b" })),
    );
    expect(rows.map((r) => r.number).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("gets by id and by number, scoped to the guild", async () => {
    const row = await make();
    expect((await repo.getById(row.id))?.number).toBe(row.number);
    expect((await repo.getByNumber(guildId, row.number))?.id).toBe(row.id);
    expect(await repo.getByNumber(otherGuild, row.number + 100)).toBeNull();
    expect(await repo.getById(randomUUID())).toBeNull();
  });

  it("setPost stores the message location and thread", async () => {
    const row = await make();
    await repo.setPost(row.id, { channelId: "c1", messageId: "m1" });
    expect(await repo.getById(row.id)).toMatchObject({ channelId: "c1", messageId: "m1", threadId: null });
    await repo.setPost(row.id, { channelId: "c1", messageId: "m1", threadId: "t1" });
    expect((await repo.getById(row.id))?.threadId).toBe("t1");
  });

  it("setStatus records the reviewer and returns the updated row", async () => {
    const row = await make();
    const updated = await repo.setStatus(row.id, { status: "approved", reason: "Great idea", reviewedBy: "mod1" });
    expect(updated).toMatchObject({ status: "approved", statusReason: "Great idea", reviewedBy: "mod1" });
    expect(updated!.reviewedAt).toBeInstanceOf(Date);
    const cleared = await repo.setStatus(row.id, { status: "pending", reason: null, reviewedBy: "mod2" });
    expect(cleared).toMatchObject({ status: "pending", statusReason: null, reviewedBy: "mod2" });
  });

  it("setStatus never resurrects a withdrawn suggestion", async () => {
    const row = await make();
    await repo.setStatus(row.id, { status: "considering", reason: "Looking", reviewedBy: "mod1" });
    await repo.markWithdrawn(row.id);
    const result = await repo.setStatus(row.id, { status: "approved", reason: "Late", reviewedBy: "mod2" });
    expect(result).toBeNull();
    expect(await repo.getById(row.id)).toMatchObject({
      status: "withdrawn",
      statusReason: "Looking",
      reviewedBy: "mod1",
    });
  });

  it("setStatus returns null for an unknown id", async () => {
    expect(await repo.setStatus(randomUUID(), { status: "approved", reason: null, reviewedBy: "mod1" })).toBeNull();
  });

  it("deleteById removes the row", async () => {
    const row = await make();
    await repo.deleteById(row.id);
    expect(await repo.getById(row.id)).toBeNull();
  });

  it("marks withdrawn by id, by message, and by channel (only non-withdrawn rows count)", async () => {
    const a = await make();
    const b = await make();
    const c = await make();
    await repo.setPost(a.id, { channelId: "wc1", messageId: "wm1" });
    await repo.setPost(b.id, { channelId: "wc1", messageId: "wm2" });
    await repo.setPost(c.id, { channelId: "wc2", messageId: "wm3" });
    expect(await repo.markWithdrawnByMessage(guildId, "wm1")).toBe(1);
    expect(await repo.markWithdrawnByMessage(guildId, "wm1")).toBe(0);
    expect((await repo.getById(a.id))?.status).toBe("withdrawn");
    expect(await repo.markWithdrawnByChannel(guildId, "wc1")).toBe(1); // b only; a already withdrawn
    expect((await repo.getById(b.id))?.status).toBe("withdrawn");
    await repo.markWithdrawn(c.id);
    expect((await repo.getById(c.id))?.status).toBe("withdrawn");
  });

  it("markWithdrawnByMessages withdraws only the listed, non-withdrawn rows of the guild", async () => {
    const g = extraGuild("bulk");
    const g2 = extraGuild("bulk-other");
    const mk = async (guild: string, messageId: string) => {
      const r = await repo.create({ guildId: guild, authorId: "u", title: "t", body: "b" });
      await repo.setPost(r.id, { channelId: "bc", messageId });
      return r;
    };
    const a = await mk(g, "bm1");
    const b = await mk(g, "bm2");
    const c = await mk(g, "bm3"); // not listed
    const d = await mk(g, "bm4"); // already withdrawn
    const foreign = await mk(g2, "bm1"); // same message id, other guild
    await repo.markWithdrawn(d.id);

    expect(await repo.markWithdrawnByMessages(g, ["bm1", "bm2", "bm4", "unknown"])).toBe(2);
    expect((await repo.getById(a.id))?.status).toBe("withdrawn");
    expect((await repo.getById(b.id))?.status).toBe("withdrawn");
    expect((await repo.getById(c.id))?.status).toBe("pending");
    expect((await repo.getById(foreign.id))?.status).toBe("pending");
    expect(await repo.markWithdrawnByMessages(g, ["bm1", "bm2"])).toBe(0);
  });

  it("markWithdrawnByMessages returns 0 for an empty list", async () => {
    expect(await repo.markWithdrawnByMessages(guildId, [])).toBe(0);
  });

  it("lists newest first, filtered by status, with a before-cursor", async () => {
    const g = extraGuild("list");
    const mk = (title: string) => repo.create({ guildId: g, authorId: "u", title, body: "b" });
    const one = await mk("one");
    await new Promise((r) => setTimeout(r, 15));
    const two = await mk("two");
    await new Promise((r) => setTimeout(r, 15));
    const three = await mk("three");
    await repo.setStatus(two.id, { status: "approved", reason: null, reviewedBy: "m" });

    const all = await repo.list(g, { limit: 10 });
    expect(all.map((r) => r.title)).toEqual(["three", "two", "one"]);
    expect((await repo.list(g, { status: "approved", limit: 10 })).map((r) => r.title)).toEqual(["two"]);
    expect((await repo.list(g, { limit: 10, before: three.createdAt })).map((r) => r.title)).toEqual(["two", "one"]);
    expect((await repo.list(g, { limit: 1 })).map((r) => r.title)).toEqual(["three"]);
    expect(one.number).toBe(1);
  });

  it("autocomplete excludes withdrawn rows, filters by number prefix, newest number first", async () => {
    const g = extraGuild("ac");
    const rows = [];
    for (let i = 0; i < 12; i++) rows.push(await repo.create({ guildId: g, authorId: "u", title: `t${i}`, body: "b" }));
    await repo.markWithdrawn(rows[11]!.id); // #12
    expect((await repo.listForAutocomplete(g, "", 25)).map((r) => r.number)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect((await repo.listForAutocomplete(g, "1", 25)).map((r) => r.number)).toEqual([11, 10, 1]);
    expect((await repo.listForAutocomplete(g, "1", 2)).map((r) => r.number)).toEqual([11, 10]);
    expect(await repo.listForAutocomplete(g, "x%", 25)).toHaveLength(11); // non-digits are ignored
  });
});
