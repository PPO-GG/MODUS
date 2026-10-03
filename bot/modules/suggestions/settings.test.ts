import { describe, expect, it } from "vitest";
import { parseSuggestionsSettings } from "./settings";

describe("parseSuggestionsSettings", () => {
  it("is unconfigured but valid for empty settings (config absent or DB error swallowed as {})", () => {
    for (const raw of [undefined, null, {}]) {
      const parsed = parseSuggestionsSettings(raw);
      expect(parsed.configured).toBe(false);
      expect(parsed.invalid).toBe(false);
      expect(parsed.settings).toEqual({
        channelId: null,
        staffRoleIds: [],
        createThread: true,
        closeVotingOnDecision: true,
      });
    }
  });

  it("is configured when a channel is set, keeping the other values", () => {
    const parsed = parseSuggestionsSettings({
      channelId: "c1",
      staffRoleIds: ["r1", "r2"],
      createThread: false,
      closeVotingOnDecision: false,
    });
    expect(parsed.configured).toBe(true);
    expect(parsed.settings).toEqual({
      channelId: "c1",
      staffRoleIds: ["r1", "r2"],
      createThread: false,
      closeVotingOnDecision: false,
    });
  });

  it("treats a null or missing channel as unconfigured", () => {
    expect(parseSuggestionsSettings({ channelId: null }).configured).toBe(false);
  });

  it("flags wrongly-typed settings as invalid and unconfigured, falling back to defaults", () => {
    for (const raw of [{ channelId: 5 }, { staffRoleIds: "r1" }, { createThread: "yes" }, "nope"]) {
      const parsed = parseSuggestionsSettings(raw);
      expect(parsed.invalid).toBe(true);
      expect(parsed.configured).toBe(false);
      expect(parsed.settings.createThread).toBe(true);
    }
  });
});
