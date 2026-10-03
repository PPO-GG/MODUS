import { describe, expect, it } from "vitest";
import { boardMatchesEmoji, emojiKey, normalizeEmoji, parseStarboard } from "./boards";

const board = (over: Record<string, unknown> = {}) => ({
  id: "b1",
  name: "Starboard",
  enabled: true,
  emoji: "⭐",
  threshold: 3,
  channelId: "chan-1",
  ignoredChannelIds: [],
  deleteBelowThreshold: false,
  ...over,
});

describe("normalizeEmoji / emojiKey / boardMatchesEmoji", () => {
  it("strips the variation selector so ❤ and ❤️ are the same emoji", () => {
    expect(normalizeEmoji("❤️")).toBe("❤");
    expect(emojiKey({ id: null, name: "❤️" })).toBe(emojiKey({ id: null, name: "❤" }));
    const parsed = parseStarboard({ boards: [board({ emoji: "❤" })] }).boards[0]!;
    expect(boardMatchesEmoji(parsed, emojiKey({ id: null, name: "❤️" }))).toBe(true);
    const parsedVs = parseStarboard({ boards: [board({ emoji: "❤️" })] }).boards[0]!;
    expect(boardMatchesEmoji(parsedVs, emojiKey({ id: null, name: "❤" }))).toBe(true);
  });

  it("uses the id for custom emoji and matches on it", () => {
    expect(emojiKey({ id: "123456789012345678", name: "pog" })).toBe("123456789012345678");
    const parsed = parseStarboard({ boards: [board({ emoji: "123456789012345678" })] }).boards[0]!;
    expect(boardMatchesEmoji(parsed, "123456789012345678")).toBe(true);
    expect(boardMatchesEmoji(parsed, "⭐")).toBe(false);
  });

  it("falls back to an empty key for a nameless, idless emoji", () => {
    expect(emojiKey({ id: null, name: null })).toBe("");
  });
});

describe("parseStarboard", () => {
  it("returns valid boards with defaults applied", () => {
    const { boards, invalidCount } = parseStarboard({
      boards: [{ id: "b1", name: "S", emoji: "⭐", threshold: 3, channelId: "c1" }],
    });
    expect(invalidCount).toBe(0);
    expect(boards).toEqual([
      {
        id: "b1",
        name: "S",
        enabled: true,
        emoji: "⭐",
        threshold: 3,
        channelId: "c1",
        ignoredChannelIds: [],
        deleteBelowThreshold: false,
      },
    ]);
  });

  it("skips invalid boards but still reports every stored id", () => {
    const parsed = parseStarboard({
      boards: [board({ id: "good" }), board({ id: "bad", threshold: 0 }), { nonsense: true }],
    });
    expect(parsed.boards.map((b) => b.id)).toEqual(["good"]);
    expect(parsed.allBoardIds).toEqual(["good", "bad"]);
    expect(parsed.invalidCount).toBe(2);
  });

  it("rejects thresholds outside 1–100", () => {
    expect(parseStarboard({ boards: [board({ threshold: 101 })] }).boards).toEqual([]);
    expect(parseStarboard({ boards: [board({ threshold: 1.5 })] }).boards).toEqual([]);
    expect(parseStarboard({ boards: [board({ threshold: 100 })] }).boards).toHaveLength(1);
  });

  it("drops a later board that repeats an earlier board's emoji and channel", () => {
    const parsed = parseStarboard({
      boards: [
        board({ id: "a", emoji: "❤" }),
        board({ id: "b", emoji: "❤️" }),
        board({ id: "c", emoji: "❤", channelId: "chan-2" }),
      ],
    });
    expect(parsed.boards.map((b) => b.id)).toEqual(["a", "c"]);
    expect(parsed.invalidCount).toBe(1);
    expect(parsed.allBoardIds).toEqual(["a", "b", "c"]);
  });

  it("caps the number of boards", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      board({ id: `b${i}`, channelId: `chan-${i}` }),
    );
    expect(parseStarboard({ boards: many }).boards).toHaveLength(10);
  });

  it("returns allBoardIds=null when settings have no boards array (config absent or DB error swallowed as {})", () => {
    for (const raw of [undefined, null, {}, { boards: "nope" }, "x"]) {
      expect(parseStarboard(raw)).toEqual({ boards: [], allBoardIds: null, invalidCount: 0 });
    }
  });

  it("returns an empty (non-null) id list for an explicit empty boards array", () => {
    expect(parseStarboard({ boards: [] }).allBoardIds).toEqual([]);
  });
});
