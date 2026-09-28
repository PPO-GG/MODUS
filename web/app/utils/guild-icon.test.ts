import { describe, expect, it } from "vitest";
import { guildIconUrl, guildInitials } from "./guild-icon";

describe("guildIconUrl", () => {
  it("returns null without an icon hash", () => {
    expect(guildIconUrl("123", null)).toBeNull();
    expect(guildIconUrl("123", undefined)).toBeNull();
    expect(guildIconUrl("123", "")).toBeNull();
  });

  it("builds a png CDN url with the default size", () => {
    expect(guildIconUrl("123", "abc")).toBe(
      "https://cdn.discordapp.com/icons/123/abc.png?size=64",
    );
  });

  it("uses gif for animated hashes and honours size", () => {
    expect(guildIconUrl("123", "a_abc", 128)).toBe(
      "https://cdn.discordapp.com/icons/123/a_abc.gif?size=128",
    );
  });
});

describe("guildInitials", () => {
  it("takes the first letter of up to two words, uppercased", () => {
    expect(guildInitials("the ppo corporation")).toBe("TP");
    expect(guildInitials("MYND's Server")).toBe("MS");
    expect(guildInitials("modus")).toBe("M");
  });

  it("ignores extra whitespace and falls back to ?", () => {
    expect(guildInitials("  spaced   out  ")).toBe("SO");
    expect(guildInitials("")).toBe("?");
    expect(guildInitials(null)).toBe("?");
    expect(guildInitials(undefined)).toBe("?");
  });

  it("uses the first code point, not a UTF-16 unit", () => {
    expect(guildInitials("🎮 gamers club")).toBe("🎮G");
  });
});
