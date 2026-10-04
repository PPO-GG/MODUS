import { describe, expect, it } from "vitest";
import {
  parseReviewBody,
  parsePanelBody,
  resolveDeployMode,
  isPostablePanelChannel,
  isArchivedThreadError,
  PANEL_DEFAULTS,
  PANEL_LIMITS,
} from "./suggestions";

describe("parseReviewBody", () => {
  it("accepts a valid body and trims the reason", () => {
    expect(parseReviewBody({ guild_id: "g1", id: "s1", status: "approved", reason: "  nice  " })).toEqual({
      ok: true,
      value: { guildId: "g1", id: "s1", status: "approved", reason: "nice" },
    });
  });

  it("treats a missing or blank reason as null", () => {
    const missing = parseReviewBody({ guild_id: "g1", id: "s1", status: "denied" });
    const blank = parseReviewBody({ guild_id: "g1", id: "s1", status: "denied", reason: "   " });
    expect(missing.ok && missing.value.reason).toBeNull();
    expect(blank.ok && blank.value.reason).toBeNull();
  });

  it("requires guild_id, id and status", () => {
    for (const body of [{}, { guild_id: "g" }, { guild_id: "g", id: "s" }, null, "x"]) {
      const parsed = parseReviewBody(body);
      expect(parsed.ok).toBe(false);
    }
  });

  it("refuses statuses staff cannot set, including withdrawn", () => {
    for (const status of ["withdrawn", "bogus", ""]) {
      const parsed = parseReviewBody({ guild_id: "g", id: "s", status });
      expect(parsed.ok).toBe(false);
    }
  });

  it("refuses a reason over 500 characters", () => {
    expect(parseReviewBody({ guild_id: "g", id: "s", status: "approved", reason: "r".repeat(501) }).ok).toBe(false);
    expect(parseReviewBody({ guild_id: "g", id: "s", status: "approved", reason: "r".repeat(500) }).ok).toBe(true);
  });
});

describe("parsePanelBody", () => {
  const ok = { guild_id: "g1", channel_id: "123456789012345678", title: "Ideas", blurb: "Tell us", button_label: "Suggest" };

  it("accepts a complete body", () => {
    expect(parsePanelBody(ok)).toEqual({
      ok: true,
      value: { guildId: "g1", channelId: "123456789012345678", title: "Ideas", blurb: "Tell us", buttonLabel: "Suggest" },
    });
  });

  it("requires guild_id and a numeric channel_id", () => {
    expect(parsePanelBody({ ...ok, guild_id: "" }).ok).toBe(false);
    expect(parsePanelBody({ ...ok, channel_id: "" }).ok).toBe(false);
    expect(parsePanelBody({ ...ok, channel_id: "../../users/@me" }).ok).toBe(false);
    expect(parsePanelBody({ ...ok, channel_id: "123" }).ok).toBe(false);
    expect(parsePanelBody(null).ok).toBe(false);
  });

  it("uses the defaults for blank or missing texts", () => {
    const parsed = parsePanelBody({ guild_id: "g1", channel_id: "123456789012345678", title: "  " });
    expect(parsed).toEqual({
      ok: true,
      value: {
        guildId: "g1",
        channelId: "123456789012345678",
        title: PANEL_DEFAULTS.title,
        blurb: PANEL_DEFAULTS.blurb,
        buttonLabel: PANEL_DEFAULTS.buttonLabel,
      },
    });
  });

  it("rejects texts over the limits and accepts them exactly at the limits", () => {
    expect(parsePanelBody({ ...ok, title: "t".repeat(101) }).ok).toBe(false);
    expect(parsePanelBody({ ...ok, blurb: "b".repeat(1501) }).ok).toBe(false);
    expect(parsePanelBody({ ...ok, button_label: "l".repeat(81) }).ok).toBe(false);
    expect(
      parsePanelBody({ ...ok, title: "t".repeat(100), blurb: "b".repeat(1500), button_label: "l".repeat(80) }).ok,
    ).toBe(true);
  });
});

describe("resolveDeployMode", () => {
  it("edits only when the stored panel is in the same channel and has a message id", () => {
    expect(resolveDeployMode({ panelChannelId: "c1", panelMessageId: "m1" }, "c1")).toEqual({
      mode: "edit",
      messageId: "m1",
    });
  });

  it("posts when nothing, a different channel, or a partial record is stored", () => {
    expect(resolveDeployMode({}, "c1")).toEqual({ mode: "post" });
    expect(resolveDeployMode({ panelChannelId: "c2", panelMessageId: "m1" }, "c1")).toEqual({ mode: "post" });
    expect(resolveDeployMode({ panelChannelId: "c1" }, "c1")).toEqual({ mode: "post" });
    expect(resolveDeployMode({ panelChannelId: "c1", panelMessageId: "" }, "c1")).toEqual({ mode: "post" });
    expect(resolveDeployMode({ panelChannelId: 5, panelMessageId: 6 }, "c1")).toEqual({ mode: "post" });
  });
});

describe("isPostablePanelChannel", () => {
  it("accepts text and announcement channels of the same guild", () => {
    expect(isPostablePanelChannel({ guild_id: "g1", type: 0 }, "g1")).toBe(true);
    expect(isPostablePanelChannel({ guild_id: "g1", type: 5 }, "g1")).toBe(true);
  });

  it("rejects another guild's channel, a missing guild_id, and other channel types", () => {
    expect(isPostablePanelChannel({ guild_id: "other", type: 0 }, "g1")).toBe(false);
    expect(isPostablePanelChannel({ type: 0 }, "g1")).toBe(false);
    for (const type of [2, 4, 15, 16, 11]) {
      expect(isPostablePanelChannel({ guild_id: "g1", type }, "g1")).toBe(false);
    }
    expect(isPostablePanelChannel(null, "g1")).toBe(false);
    expect(isPostablePanelChannel("nope", "g1")).toBe(false);
  });
});

describe("isArchivedThreadError", () => {
  it("is true for Discord's archived-thread error code (50083)", () => {
    expect(isArchivedThreadError({ data: { code: 50083 } })).toBe(true);
    expect(isArchivedThreadError({ response: { _data: { code: 50083 } } })).toBe(true);
  });

  it("is false for other errors and non-errors", () => {
    expect(isArchivedThreadError({ data: { code: 10008 } })).toBe(false);
    expect(isArchivedThreadError({ statusCode: 404 })).toBe(false);
    expect(isArchivedThreadError(new Error("boom"))).toBe(false);
    expect(isArchivedThreadError(null)).toBe(false);
    expect(isArchivedThreadError(undefined)).toBe(false);
  });
});
