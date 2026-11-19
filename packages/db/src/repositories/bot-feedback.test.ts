import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { createDb } from "../client";
import { botFeedback } from "../schema";
import { BotFeedbackRepository, type FeedbackContextV1 } from "./bot-feedback";

const url = process.env.TEST_DATABASE_URL;

const context: FeedbackContextV1 = {
  v: 1,
  guildName: "Test Guild",
  memberCount: 12,
  shardId: 0,
  botVersion: "1.0.0",
  locale: "en-US",
};

describe.skipIf(!url)("BotFeedbackRepository (integration)", () => {
  const { db, pool } = createDb({ url });
  const repo = new BotFeedbackRepository(db);
  const tag = `test-${randomUUID()}`;
  const userA = `${tag}-a`;
  const userB = `${tag}-b`;
  const guildId = `${tag}-g`;
  const created: string[] = [];

  const make = async (over: Partial<Parameters<BotFeedbackRepository["create"]>[0]> = {}) => {
    const row = await repo.create({
      guildId,
      userId: userA,
      category: "idea",
      message: "A message long enough",
      contactOk: false,
      context,
      ...over,
    });
    created.push(row.id);
    return row;
  };

  const pause = () => new Promise((r) => setTimeout(r, 5));

  afterAll(async () => {
    if (created.length) await db.delete(botFeedback).where(inArray(botFeedback.id, created));
    await pool.end();
  });

  it("create returns an open row with the given contactOk and context", async () => {
    const row = await make({ contactOk: true });
    expect(row.status).toBe("open");
    expect(row.contactOk).toBe(true);
    expect(row.context).toEqual(context);
    expect(row.resolvedAt).toBeNull();
  });

  it("countSince counts only that user's rows at or after since", async () => {
    const u = `${tag}-count`;
    const since = new Date(Date.now() - 1000);
    await make({ userId: u });
    await make({ userId: userB });
    expect(await repo.countSince(u, since)).toBe(1);
    expect(await repo.countSince(u, new Date(Date.now() + 60_000))).toBe(0);
  });

  it("list by status returns only open rows, newest first, capped at limit", async () => {
    const a = await make({ message: "first message here" });
    await pause();
    const b = await make({ message: "second message here" });
    await repo.setStatus(a.id, "resolved", "admin");
    const open = await repo.list({ status: "open", limit: 1000 });
    expect(open.every((r) => r.status === "open")).toBe(true);
    expect(open.map((r) => r.id)).toContain(b.id);
    expect(open.map((r) => r.id)).not.toContain(a.id);
    const times = open.map((r) => r.createdAt.getTime());
    expect(times).toEqual([...times].sort((x, y) => y - x));
    expect(await repo.list({ limit: 1 })).toHaveLength(1);
  });

  it("list with before returns only rows older than the cursor", async () => {
    const older = await make({ message: "older message here" });
    await pause();
    const newer = await make({ message: "newer message here" });
    const ids = (await repo.list({ before: newer.createdAt, limit: 1000 })).map((r) => r.id);
    expect(ids).toContain(older.id);
    expect(ids).not.toContain(newer.id);
  });

  it("setStatus resolved sets resolvedAt and resolvedBy, open clears both", async () => {
    const row = await make();
    const resolved = await repo.setStatus(row.id, "resolved", "admin-1");
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.resolvedBy).toBe("admin-1");
    expect(resolved?.resolvedAt).toBeInstanceOf(Date);
    const reopened = await repo.setStatus(row.id, "open", "admin-1");
    expect(reopened?.status).toBe("open");
    expect(reopened?.resolvedBy).toBeNull();
    expect(reopened?.resolvedAt).toBeNull();
  });

  it("setStatus returns null for an unknown id", async () => {
    expect(await repo.setStatus(randomUUID(), "resolved", "admin")).toBeNull();
  });
});
