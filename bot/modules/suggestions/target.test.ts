import { ChannelType } from "discord.js";
import { describe, expect, it } from "vitest";
import { isThreadOnlyType, pickRequiredTag, submitTarget } from "./target";

describe("submitTarget", () => {
  it("maps text and announcement channels to the text flow", () => {
    expect(submitTarget(ChannelType.GuildText)).toBe("text");
    expect(submitTarget(ChannelType.GuildAnnouncement)).toBe("text");
  });

  it("maps forum and media channels to the forum flow", () => {
    expect(submitTarget(ChannelType.GuildForum)).toBe("forum");
    expect(submitTarget(ChannelType.GuildMedia)).toBe("forum");
  });

  it("rejects everything else, including a missing channel", () => {
    for (const type of [ChannelType.GuildVoice, ChannelType.GuildCategory, ChannelType.PublicThread, ChannelType.DM]) {
      expect(submitTarget(type)).toBeNull();
    }
    expect(submitTarget(undefined)).toBeNull();
    expect(submitTarget(null)).toBeNull();
  });
});

describe("isThreadOnlyType", () => {
  it("is true only for forum and media parents", () => {
    expect(isThreadOnlyType(ChannelType.GuildForum)).toBe(true);
    expect(isThreadOnlyType(ChannelType.GuildMedia)).toBe(true);
    expect(isThreadOnlyType(ChannelType.GuildText)).toBe(false);
    expect(isThreadOnlyType(undefined)).toBe(false);
  });
});

describe("pickRequiredTag", () => {
  const tag = (id: string, name: string, moderated = false) => ({ id, name, moderated });

  it("prefers a non-moderated tag whose name mentions suggestions", () => {
    expect(pickRequiredTag([tag("1", "Bug"), tag("2", "Suggestion"), tag("3", "Idea")])).toBe("2");
    expect(pickRequiredTag([tag("1", "Bug"), tag("2", "Feature SUGGESTIONS")])).toBe("2");
  });

  it("falls back to the first non-moderated tag", () => {
    expect(pickRequiredTag([tag("1", "Bug"), tag("2", "Idea")])).toBe("1");
  });

  it("never picks a moderated tag", () => {
    expect(pickRequiredTag([tag("1", "Suggestion", true), tag("2", "Idea")])).toBe("2");
    expect(pickRequiredTag([tag("1", "Suggestion", true), tag("2", "Idea", true)])).toBeNull();
  });

  it("returns null when there are no tags", () => {
    expect(pickRequiredTag([])).toBeNull();
  });
});
