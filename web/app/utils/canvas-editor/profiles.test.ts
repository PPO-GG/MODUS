import { describe, expect, it } from "vitest";
import { rankCardProfile } from "./profiles/rank-card";
import { welcomeProfile } from "./profiles/welcome";
import { imageLayerCount } from "./elements";
import type { CanvasElementType } from "./types";

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

describe("drawing-side behaviour matrix", () => {
  it("welcome fallbacks match the old Welcome editor", () => {
    expect(welcomeProfile.fallback).toEqual({
      rectFill: "#ffffff",
      circleFill: "#ffffff",
      starFill: "#374151",
      lineStroke: "#e4e4e7",
      textAlign: "center",
      avatarRadius: 64,
      avatarBorder: "#ffffff",
    });
  });

  it("rank card fallbacks match the old rank card editor", () => {
    expect(rankCardProfile.fallback).toEqual({
      rectFill: "#111827",
      circleFill: "#6366f1",
      starFill: "#eab308",
      lineStroke: "#6366f1",
      textAlign: "left",
      avatarRadius: 56,
      avatarBorder: "#818cf8",
    });
  });

  it("welcome new elements use the Welcome defaults", () => {
    const at = (type: CanvasElementType) => welcomeProfile.newElement(type, 300, 200)!;
    expect(at("text")).toMatchObject({ x: 300, y: 200, fill: "#ffffff", align: "center" });
    expect(at("rect")).toMatchObject({ x: 225, y: 150, width: 150, height: 100, fill: "#374151" });
    expect(at("circle")).toMatchObject({ x: 300, y: 200, radius: 50, fill: "#4f46e5" });
    expect(at("star")).toMatchObject({ fill: "#374151", numPoints: 5, innerRadius: 25, outerRadius: 50 });
    expect(at("line")).toMatchObject({ stroke: "#e4e4e7", strokeWidth: 3, points: [-60, 0, 60, 0] });
    expect(at("avatar")).toMatchObject({
      x: 300,
      y: 120,
      radius: 64,
      borderColor: "#a78bfa",
      borderWidth: 3,
    });
  });

  it("rank card new elements use the rank card defaults", () => {
    const at = (type: CanvasElementType) => rankCardProfile.newElement(type, 300, 200)!;
    expect(at("text")).toMatchObject({ x: 300, y: 200, fill: "#ffffff", align: "left" });
    expect(at("rect")).toMatchObject({ x: 225, y: 150, width: 150, height: 100, fill: "#1e1b4b" });
    expect(at("circle")).toMatchObject({ x: 300, y: 200, radius: 50, fill: "#6366f1" });
    expect(at("star")).toMatchObject({ fill: "#eab308", numPoints: 5, innerRadius: 25, outerRadius: 50 });
    expect(at("line")).toMatchObject({ stroke: "#6366f1", strokeWidth: 3, points: [-60, 0, 60, 0] });
  });

  it("the rank card avatar and progress bar ignore the click position", () => {
    const avatar = rankCardProfile.newElement("avatar", 300, 200)!;
    expect(avatar).toMatchObject({
      x: 100,
      y: 141,
      radius: 56,
      borderColor: "#818cf8",
      borderWidth: 3,
    });
    expect(rankCardProfile.newElement("progressbar", 300, 200)).toMatchObject({
      x: 195,
      y: 195,
      width: 680,
      height: 18,
      cornerRadius: 9,
      trackColor: "rgba(255, 255, 255, 0.08)",
      fill: "linear-gradient(90deg, #6366f1, #a855f7, #ec4899)",
    });
  });

  it("the welcome profile has no progress bar element", () => {
    expect(welcomeProfile.newElement("progressbar", 300, 200)).toBeUndefined();
  });
});
