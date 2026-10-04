import { describe, expect, it } from "vitest";
import { parseSuggestionsSettings } from "./settings";

const PANEL_DEFAULTS = {
  panelTitle: "Suggestions",
  panelBlurb: "Have an idea for the server? Press the button below to submit it.",
  panelButtonLabel: "New suggestion",
  panelChannelId: null,
  panelMessageId: null,
};

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
        ...PANEL_DEFAULTS,
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
      ...PANEL_DEFAULTS,
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

  it("keeps stored panel fields, trimming the copy", () => {
    const parsed = parseSuggestionsSettings({
      channelId: "c1",
      panelTitle: "  Ideas  ",
      panelBlurb: "Tell us!",
      panelButtonLabel: "Suggest",
      panelChannelId: "p1",
      panelMessageId: "m1",
    });
    expect(parsed.settings).toMatchObject({
      panelTitle: "Ideas",
      panelBlurb: "Tell us!",
      panelButtonLabel: "Suggest",
      panelChannelId: "p1",
      panelMessageId: "m1",
    });
  });

  it("falls back per field for bad panel values without invalidating the config", () => {
    const parsed = parseSuggestionsSettings({
      channelId: "c1",
      panelTitle: "   ",
      panelBlurb: "x".repeat(1501),
      panelButtonLabel: 5,
      panelChannelId: 7,
      panelMessageId: "",
    });
    expect(parsed.invalid).toBe(false);
    expect(parsed.configured).toBe(true);
    expect(parsed.settings).toMatchObject({ channelId: "c1", ...PANEL_DEFAULTS });
  });

  it("accepts the limits exactly", () => {
    const parsed = parseSuggestionsSettings({
      channelId: "c1",
      panelTitle: "t".repeat(100),
      panelBlurb: "b".repeat(1500),
      panelButtonLabel: "l".repeat(80),
    });
    expect(parsed.settings.panelTitle).toHaveLength(100);
    expect(parsed.settings.panelBlurb).toHaveLength(1500);
    expect(parsed.settings.panelButtonLabel).toHaveLength(80);
  });
});
