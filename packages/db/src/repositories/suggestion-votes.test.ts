import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { inArray } from "drizzle-orm";
import { createDb } from "../client";
import { suggestionVotes } from "../schema";
import { SuggestionVoteRepository } from "./suggestion-votes";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("SuggestionVoteRepository (integration)", () => {
  const { db, pool } = createDb({ url });
  const repo = new SuggestionVoteRepository(db);
  const s1 = `test-${randomUUID()}`;
  const s2 = `test-${randomUUID()}`;

  afterAll(async () => {
    await db.delete(suggestionVotes).where(inArray(suggestionVotes.suggestionId, [s1, s2]));
    await pool.end();
  });

  it("toggle adds, removes on the same direction, and switches on the opposite one", async () => {
    expect(await repo.toggle(s1, "u1", "up")).toBe("added");
    expect(await repo.tally(s1)).toEqual({ up: 1, down: 0 });
    expect(await repo.toggle(s1, "u1", "down")).toBe("switched");
    expect(await repo.tally(s1)).toEqual({ up: 0, down: 1 });
    expect(await repo.toggle(s1, "u1", "down")).toBe("removed");
    expect(await repo.tally(s1)).toEqual({ up: 0, down: 0 });
  });

  it("keeps one row per user even when first clicks race", async () => {
    await Promise.all(Array.from({ length: 5 }, () => repo.toggle(s2, "racer", "up")));
    const voters = await repo.listVoters(s2);
    expect(voters.filter((v) => v.userId === "racer").length).toBeLessThanOrEqual(1);
    expect((await repo.tally(s2)).up).toBeLessThanOrEqual(1);
  });

  it("tallies many suggestions at once, defaulting missing ones to zero", async () => {
    await repo.toggle(s1, "a", "up");
    await repo.toggle(s1, "b", "up");
    await repo.toggle(s1, "c", "down");
    const map = await repo.tallies([s1, "no-votes-here"]);
    expect(map.get(s1)).toEqual({ up: 2, down: 1 });
    expect(map.get("no-votes-here")).toEqual({ up: 0, down: 0 });
    expect((await repo.tallies([])).size).toBe(0);
  });

  it("lists voters oldest first with their direction", async () => {
    const voters = await repo.listVoters(s1);
    expect(voters.map((v) => v.userId)).toEqual(["a", "b", "c"]);
    expect(voters.map((v) => v.direction)).toEqual(["up", "up", "down"]);
  });
});
