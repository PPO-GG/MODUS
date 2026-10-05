import { describe, expect, it } from "vitest";
import {
  describeBoard,
  isCustomEmoji,
  MAX_NAME_LENGTH,
  newBoard,
  normalizeEmoji,
  parseEmojiInput,
  toSavedBoard,
  validateBoard,
} from "./starboard";

const valid = () => ({ ...newBoard("b1"), name: "Starboard", channelId: "chan-1" });

describe("parseEmojiInput", () => {
  it("accepts a unicode emoji as typed", () => {
    expect(parseEmojiInput("⭐")).toBe("⭐");
    expect(parseEmojiInput("  💀 ")).toBe("💀");
    expect(parseEmojiInput("❤️")).toBe("❤️");
  });

  it("extracts the id from a pasted custom emoji, static or animated", () => {
    expect(parseEmojiInput("<:pog:123456789012345678>")).toBe("123456789012345678");
    expect(parseEmojiInput("<a:dance:123456789012345678>")).toBe("123456789012345678");
  });

  it("accepts a bare custom emoji id", () => {
    expect(parseEmojiInput("123456789012345678")).toBe("123456789012345678");
  });

  it("rejects plain text, empty input and malformed ids", () => {
    expect(parseEmojiInput("")).toBeNull();
    expect(parseEmojiInput("star")).toBeNull();
    expect(parseEmojiInput("12345")).toBeNull();
    expect(parseEmojiInput("<:pog:abc>")).toBeNull();
  });

  it("rejects multi-emoji and mixed text/emoji", () => {
    expect(parseEmojiInput("⭐⭐")).toBeNull();
    expect(parseEmojiInput("star ⭐")).toBeNull();
    expect(parseEmojiInput("a⭐")).toBeNull();
    expect(parseEmojiInput("⭐ 💀")).toBeNull();
  });

  it("accepts single emoji graphemes including skin tones, ZWJ, flags, and keycaps", () => {
    expect(parseEmojiInput("❤️")).toBe("❤️");
    expect(parseEmojiInput("👍🏽")).toBe("👍🏽");
    expect(parseEmojiInput("👨‍👩‍👧")).toBe("👨‍👩‍👧");
    expect(parseEmojiInput("🇺🇸")).toBe("🇺🇸");
    expect(parseEmojiInput("1️⃣")).toBe("1️⃣");
  });
});

describe("emoji helpers", () => {
  it("normalizeEmoji strips the variation selector", () => {
    expect(normalizeEmoji("❤️")).toBe("❤");
  });
  it("isCustomEmoji is true only for numeric ids", () => {
    expect(isCustomEmoji("123456789012345678")).toBe(true);
    expect(isCustomEmoji("⭐")).toBe(false);
  });
});

describe("newBoard", () => {
  it("defaults to a ⭐ board at threshold 3 with unstar-delete off", () => {
    expect(newBoard("x")).toEqual({
      id: "x",
      name: "",
      enabled: true,
      emoji: "⭐",
      threshold: 3,
      channelId: "",
      ignoredChannelIds: [],
      watchedChannelIds: [],
      autoReact: false,
      deleteBelowThreshold: false,
    });
  });
});

describe("validateBoard", () => {
  it("accepts a complete board", () => {
    expect(validateBoard(valid(), [])).toBeNull();
  });

  it("requires a name and a target channel", () => {
    expect(validateBoard({ ...valid(), name: "  " }, [])).toMatch(/name/i);
    expect(validateBoard({ ...valid(), channelId: "" }, [])).toMatch(/channel/i);
  });

  it("requires name to be 80 characters or fewer", () => {
    const tooLong = "x".repeat(81);
    const exactLimit = "x".repeat(80);
    expect(validateBoard({ ...valid(), name: tooLong }, [])).toMatch(/80/);
    expect(validateBoard({ ...valid(), name: exactLimit }, [])).toBeNull();
  });

  it("requires a valid emoji", () => {
    expect(validateBoard({ ...valid(), emoji: "star" }, [])).toMatch(/emoji/i);
  });

  it("requires an integer threshold between 1 and 100", () => {
    expect(validateBoard({ ...valid(), threshold: 0 }, [])).toMatch(/threshold/i);
    expect(validateBoard({ ...valid(), threshold: 101 }, [])).toMatch(/threshold/i);
    expect(validateBoard({ ...valid(), threshold: 2.5 }, [])).toMatch(/threshold/i);
    expect(validateBoard({ ...valid(), threshold: 100 }, [])).toBeNull();
  });

  it("caps the ignored channel list at 100", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);
    expect(validateBoard({ ...valid(), ignoredChannelIds: ids(101) }, [])).toMatch(/100/);
    expect(validateBoard({ ...valid(), ignoredChannelIds: ids(100) }, [])).toBeNull();
  });

  it("caps the watched channel list at 100", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `c${i}`);
    expect(validateBoard({ ...valid(), watchedChannelIds: ids(101) }, [])).toMatch(/100/);
    expect(validateBoard({ ...valid(), watchedChannelIds: ids(100) }, [])).toBeNull();
  });

  it("requires a watched channel to turn on vote reactions", () => {
    expect(validateBoard({ ...valid(), autoReact: true, watchedChannelIds: [] }, [])).toMatch(/watched channel/i);
    expect(validateBoard({ ...valid(), autoReact: true, watchedChannelIds: ["gallery"] }, [])).toBeNull();
    expect(validateBoard({ ...valid(), autoReact: false, watchedChannelIds: [] }, [])).toBeNull();
  });

  it("rejects watching the board's own channel", () => {
    expect(validateBoard({ ...valid(), watchedChannelIds: ["gallery", "chan-1"] }, [])).toMatch(
      /board channel/i,
    );
  });

  it("rejects watching another board's channel, and posting into a channel another board watches", () => {
    const other = { ...valid(), id: "b2", channelId: "fame", watchedChannelIds: ["gallery"] };
    expect(validateBoard({ ...valid(), watchedChannelIds: ["fame"] }, [other])).toMatch(/board channel/i);
    expect(validateBoard({ ...valid(), channelId: "gallery" }, [other])).toMatch(/watches/i);
    expect(validateBoard({ ...valid(), watchedChannelIds: ["gallery"] }, [other])).toBeNull();
  });

  it("rejects the same emoji + channel as another board, treating ❤ and ❤️ as equal", () => {
    const other = { ...valid(), id: "b2", emoji: "❤" };
    const draft = { ...valid(), emoji: "❤️" };
    expect(validateBoard(draft, [other])).toMatch(/already/i);
    expect(validateBoard({ ...draft, channelId: "chan-2" }, [other])).toBeNull();
  });
});

describe("toSavedBoard / describeBoard", () => {
  it("trims the name and the emoji", () => {
    const saved = toSavedBoard({ ...valid(), name: "  Hall  ", emoji: " ⭐ " });
    expect(saved.name).toBe("Hall");
    expect(saved.emoji).toBe("⭐");
  });

  it("turns vote reactions off when no channel is watched", () => {
    expect(toSavedBoard({ ...valid(), autoReact: true, watchedChannelIds: [] }).autoReact).toBe(false);
    expect(toSavedBoard({ ...valid(), autoReact: true, watchedChannelIds: ["g"] }).autoReact).toBe(true);
  });

  it("describes a board for the list row", () => {
    expect(describeBoard({ ...valid(), threshold: 5 }, "starboard")).toBe("⭐ ≥ 5 → #starboard");
    expect(describeBoard({ ...valid(), emoji: "123456789012345678", threshold: 2 }, "hall")).toBe(
      "custom emoji ≥ 2 → #hall",
    );
  });
});
