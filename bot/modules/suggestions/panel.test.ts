import { describe, expect, it } from "vitest";
import { buildPanelMessage, PANEL_COLOR, PANEL_CUSTOM_ID } from "./panel";

const texts = { panelTitle: "Suggestions", panelBlurb: "Tell us your ideas.", panelButtonLabel: "New suggestion" };

describe("buildPanelMessage", () => {
  it("builds one embed with the title and blurb", () => {
    const { embeds } = buildPanelMessage(texts);
    expect(embeds).toHaveLength(1);
    expect(embeds[0]).toEqual({ title: "Suggestions", description: "Tell us your ideas.", color: PANEL_COLOR });
  });

  it("builds one row with one primary button that opens the form", () => {
    const { components } = buildPanelMessage(texts);
    expect(components).toHaveLength(1);
    const row = components[0] as any;
    expect(row.type).toBe(1);
    expect(row.components).toEqual([
      { type: 2, style: 1, custom_id: PANEL_CUSTOM_ID, label: "New suggestion" },
    ]);
    expect(PANEL_CUSTOM_ID).toBe("suggestions:new");
  });

  it("truncates oversize copy to Discord's limits", () => {
    const { embeds, components } = buildPanelMessage({
      panelTitle: "t".repeat(400),
      panelBlurb: "b".repeat(9000),
      panelButtonLabel: "l".repeat(200),
    });
    expect(embeds[0]!.title).toHaveLength(256);
    expect(embeds[0]!.description).toHaveLength(4000);
    expect((components[0] as any).components[0].label).toHaveLength(80);
  });
});
