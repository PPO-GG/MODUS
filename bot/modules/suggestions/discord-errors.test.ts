import { describe, expect, it } from "vitest";
import { isChannelNotInGuild, isStaleInteractionError } from "./discord-errors";

describe("isChannelNotInGuild", () => {
  it("is true for Discord Unknown Channel (10003)", () => {
    expect(isChannelNotInGuild({ code: 10003 })).toBe(true);
  });

  it("is true for discord.js GuildChannelUnowned", () => {
    expect(isChannelNotInGuild({ code: "GuildChannelUnowned" })).toBe(true);
  });

  it("is false for transient or permission failures", () => {
    expect(isChannelNotInGuild({ code: 50001 })).toBe(false);
    expect(isChannelNotInGuild({ code: 500 })).toBe(false);
    expect(isChannelNotInGuild({ code: "ECONNRESET" })).toBe(false);
  });

  it("is false for an error with no code", () => {
    expect(isChannelNotInGuild(new Error("boom"))).toBe(false);
  });

  it("is false for null, undefined and non-objects", () => {
    expect(isChannelNotInGuild(null)).toBe(false);
    expect(isChannelNotInGuild(undefined)).toBe(false);
    expect(isChannelNotInGuild("GuildChannelUnowned")).toBe(false);
    expect(isChannelNotInGuild(10003)).toBe(false);
  });
});

describe("isStaleInteractionError", () => {
  it("is true for Unknown interaction (10062) and already acknowledged (40060)", () => {
    expect(isStaleInteractionError({ code: 10062 })).toBe(true);
    expect(isStaleInteractionError({ code: 40060 })).toBe(true);
  });

  it("is false for other errors and non-objects", () => {
    expect(isStaleInteractionError({ code: 50001 })).toBe(false);
    expect(isStaleInteractionError(new Error("boom"))).toBe(false);
    expect(isStaleInteractionError(null)).toBe(false);
    expect(isStaleInteractionError(10062)).toBe(false);
  });
});
