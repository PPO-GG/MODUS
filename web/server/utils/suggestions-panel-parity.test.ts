import { describe, expect, it } from "vitest";
import {
  buildPanelMessage as botBuild,
  PANEL_COLOR as BOT_COLOR,
  PANEL_CUSTOM_ID as BOT_CUSTOM_ID,
} from "../../../bot/modules/suggestions/panel";
import {
  buildPanelMessage as webBuild,
  PANEL_COLOR as WEB_COLOR,
  PANEL_CUSTOM_ID as WEB_CUSTOM_ID,
} from "../api/suggestions/_panel";
import { PANEL_DEFAULTS, PANEL_LIMITS } from "./suggestions";
import { SUGGESTION_PANEL_DEFAULTS, SUGGESTION_PANEL_LIMITS } from "../../../bot/lib/schemas";

describe("suggestion panel parity (bot ↔ web copy)", () => {
  it("renders identically for typical copy", () => {
    const texts = { panelTitle: "Suggestions", panelBlurb: "Tell us your ideas.", panelButtonLabel: "New suggestion" };
    expect(webBuild(texts)).toEqual(botBuild(texts));
  });

  it("renders identically for oversize copy (truncation behaves the same)", () => {
    const texts = { panelTitle: "t".repeat(400), panelBlurb: "b".repeat(9000), panelButtonLabel: "l".repeat(200) };
    expect(webBuild(texts)).toEqual(botBuild(texts));
  });

  it("shares the button id and colour", () => {
    expect(WEB_CUSTOM_ID).toBe(BOT_CUSTOM_ID);
    expect(WEB_COLOR).toBe(BOT_COLOR);
  });

  it("mirrors the bot's panel defaults and limits", () => {
    expect(PANEL_DEFAULTS).toEqual(SUGGESTION_PANEL_DEFAULTS);
    expect(PANEL_LIMITS).toEqual(SUGGESTION_PANEL_LIMITS);
  });
});
