import { describe, expect, it } from "vitest";
import { rankCardProfile } from "./profiles/rank-card";
import { welcomeProfile } from "./profiles/welcome";
import { imageLayerCount } from "./elements";

describe.each([
  ["welcome", welcomeProfile],
  ["rank card", rankCardProfile],
])("%s profile", (_name, profile) => {
  it("every tool except the image uploader can create an element", () => {
    for (const tool of profile.tools) {
      if (tool.type === "image") continue;
      const made = profile.newElement(tool.type, 100, 100);
      expect(made, tool.type).toBeDefined();
      expect(made!.type).toBe(tool.type);
    }
  });

  it("presets are complete templates with unique element ids and at most 10 images", () => {
    for (const preset of profile.presets) {
      const ids = preset.template.elements.map((e) => e.id);
      expect(new Set(ids).size, preset.name).toBe(ids.length);
      expect(imageLayerCount(preset.template.elements), preset.name).toBeLessThanOrEqual(10);
      expect(preset.template.canvasWidth).toBeGreaterThan(0);
    }
  });

  it("returns an independent copy of the default template", () => {
    const a = profile.defaultTemplate();
    a.elements.pop();
    expect(profile.defaultTemplate().elements.length).toBeGreaterThan(a.elements.length);
  });
});

describe("profile differences", () => {
  it("only the rank card offers a progress bar", () => {
    expect(welcomeProfile.tools.some((t) => t.type === "progressbar")).toBe(false);
    expect(rankCardProfile.tools.some((t) => t.type === "progressbar")).toBe(true);
  });

  it("shadow scope and upload endpoints match today's editors", () => {
    expect(welcomeProfile.shadow).toBe("image");
    expect(rankCardProfile.shadow).toBe("all");
    expect(welcomeProfile.uploads.image).toBe("/api/welcome/upload-image");
    expect(rankCardProfile.uploads.image).toBe("/api/xp/upload-image");
  });
});
