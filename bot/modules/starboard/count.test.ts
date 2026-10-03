import { describe, expect, it } from "vitest";
import { countReactors, REACTOR_FETCH_CAP, type ReactionLike, type UserLike } from "./count";

/** Fake reaction whose users.fetch pages through `all` ascending by id, like Discord. */
function fakeReaction(all: UserLike[], count: number | null = all.length) {
  const calls: Array<{ limit: number; after?: string }> = [];
  const sorted = [...all].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  const reaction: ReactionLike = {
    count,
    users: {
      fetch: async (options) => {
        calls.push(options);
        const after = options.after === undefined ? null : BigInt(options.after);
        const page = sorted
          .filter((u) => after === null || BigInt(u.id) > after)
          .slice(0, options.limit);
        return { size: page.length, values: () => page.values() };
      },
    },
  };
  return { reaction, calls };
}

const users = (n: number, startId = 1000): UserLike[] =>
  Array.from({ length: n }, (_, i) => ({ id: String(startId + i), bot: false }));

describe("countReactors", () => {
  it("excludes bots and the message author", async () => {
    const { reaction } = fakeReaction([
      { id: "1", bot: false },
      { id: "2", bot: true },
      { id: "3", bot: false },
      { id: "99", bot: false }, // author
    ]);
    expect(await countReactors(reaction, "99")).toBe(2);
  });

  it("counts 0 when the only reactors are the author and bots", async () => {
    const { reaction } = fakeReaction([
      { id: "99", bot: false },
      { id: "5", bot: true },
    ]);
    expect(await countReactors(reaction, "99")).toBe(0);
  });

  it("returns 0 for a reaction with no users", async () => {
    const { reaction } = fakeReaction([]);
    expect(await countReactors(reaction, "99")).toBe(0);
  });

  it("pages with `after` set to the highest id seen", async () => {
    const { reaction, calls } = fakeReaction(users(105));
    expect(await countReactors(reaction, "nobody-matches")).toBe(105);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ limit: 100, after: undefined });
    expect(calls[1]).toEqual({ limit: 100, after: "1099" });
  });

  it("falls back to reaction.count past the fetch cap", async () => {
    const { reaction, calls } = fakeReaction(users(REACTOR_FETCH_CAP + 50), 1234);
    expect(await countReactors(reaction, "nobody-matches")).toBe(1234);
    expect(calls).toHaveLength(REACTOR_FETCH_CAP / 100);
  });
});
