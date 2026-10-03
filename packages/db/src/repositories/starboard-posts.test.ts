import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDb } from "../client";
import { starboardPosts } from "../schema";
import { StarboardPostRepository } from "./starboard-posts";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("StarboardPostRepository (integration)", () => {
  const { db, pool } = createDb({ url });
  const repo = new StarboardPostRepository(db);
  const guildId = `test-${randomUUID()}`;
  const input = (over: Partial<Parameters<StarboardPostRepository["insertIfAbsent"]>[0]> = {}) => ({
    guildId,
    boardId: "b1",
    sourceChannelId: "c1",
    sourceMessageId: "m1",
    authorId: "u1",
    boardMessageId: "bm1",
    starCount: 3,
    ...over,
  });

  afterAll(async () => {
    await db.delete(starboardPosts).where(eq(starboardPosts.guildId, guildId));
    await pool.end();
  });

  it("insertIfAbsent returns the row once, then null on the same (guild, board, message)", async () => {
    const first = await repo.insertIfAbsent(input());
    expect(first?.starCount).toBe(3);
    expect(await repo.insertIfAbsent(input({ starCount: 9 }))).toBeNull();
    expect((await repo.get(guildId, "b1", "m1"))?.starCount).toBe(3);
  });

  it("insertIfAbsent lets only one of concurrent callers win", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => repo.insertIfAbsent(input({ sourceMessageId: "m-race" }))),
    );
    expect(results.filter((r) => r !== null)).toHaveLength(1);
  });

  it("the same message can sit on two different boards", async () => {
    expect(await repo.insertIfAbsent(input({ boardId: "b2", sourceMessageId: "m1", boardMessageId: "bm2" }))).not.toBeNull();
    const rows = await repo.listBySourceMessage(guildId, "m1");
    expect(rows.map((r) => r.boardId).sort()).toEqual(["b1", "b2"]);
  });

  it("get returns null for an unknown post", async () => {
    expect(await repo.get(guildId, "b1", "nope")).toBeNull();
  });

  it("update patches count and can clear the board message id", async () => {
    const row = (await repo.get(guildId, "b1", "m1"))!;
    await repo.update(row.id, { starCount: 7 });
    expect((await repo.get(guildId, "b1", "m1"))?.starCount).toBe(7);
    await repo.update(row.id, { boardMessageId: null });
    const cleared = (await repo.get(guildId, "b1", "m1"))!;
    expect(cleared.boardMessageId).toBeNull();
    expect(cleared.starCount).toBe(7);
  });

  it("deleteById removes one row only", async () => {
    const row = (await repo.insertIfAbsent(input({ sourceMessageId: "m-del" })))!;
    await repo.deleteById(row.id);
    expect(await repo.get(guildId, "b1", "m-del")).toBeNull();
    expect(await repo.get(guildId, "b1", "m1")).not.toBeNull();
  });

  it("deleteBySourceMessage removes every board's row and returns them", async () => {
    const deleted = await repo.deleteBySourceMessage(guildId, "m1");
    expect(deleted.map((r) => r.boardId).sort()).toEqual(["b1", "b2"]);
    expect(await repo.listBySourceMessage(guildId, "m1")).toEqual([]);
    expect(await repo.deleteBySourceMessage(guildId, "m1")).toEqual([]);
  });

  it("deleteBoardsNotIn drops rows of removed boards; an empty keep-list drops them all", async () => {
    await repo.insertIfAbsent(input({ boardId: "keep", sourceMessageId: "m-k" }));
    await repo.insertIfAbsent(input({ boardId: "gone", sourceMessageId: "m-g" }));
    expect(await repo.deleteBoardsNotIn(guildId, ["keep"])).toBeGreaterThanOrEqual(1);
    expect(await repo.get(guildId, "gone", "m-g")).toBeNull();
    expect(await repo.get(guildId, "keep", "m-k")).not.toBeNull();
    await repo.deleteBoardsNotIn(guildId, []);
    expect(await repo.get(guildId, "keep", "m-k")).toBeNull();
  });

  it("topPosts orders by stars and topAuthors aggregates per author", async () => {
    const g = `${guildId}-top`;
    const put = (message: string, author: string, stars: number) =>
      repo.insertIfAbsent(input({ guildId: g, boardId: "bt", sourceMessageId: message, authorId: author, starCount: stars }));
    await put("a", "alice", 5);
    await put("b", "alice", 2);
    await put("c", "bob", 6);
    const posts = await repo.topPosts(g, "bt", 2);
    expect(posts.map((p) => p.sourceMessageId)).toEqual(["c", "a"]);
    const authors = await repo.topAuthors(g, "bt", 10);
    expect(authors).toEqual([
      { authorId: "alice", posts: 2, stars: 7 },
      { authorId: "bob", posts: 1, stars: 6 },
    ]);
    await db.delete(starboardPosts).where(eq(starboardPosts.guildId, g));
  });
});
