import { describe, expect, it } from "vitest";
import {
  elementLabel,
  elementTypeIcon,
  imageLayerCount,
  previewText,
  scaleElementSize,
} from "./elements";
import { rankCardProfile } from "./profiles/rank-card";
import { welcomeProfile } from "./profiles/welcome";
import type { CanvasElement } from "./types";

const el = (partial: Partial<CanvasElement>): CanvasElement =>
  ({ id: "e", type: "rect", x: 0, y: 0, ...partial }) as CanvasElement;

describe("imageLayerCount", () => {
  it("counts only image elements", () => {
    expect(imageLayerCount([el({ type: "image" }), el({ type: "rect" }), el({ type: "image" })])).toBe(2);
  });
});

describe("scaleElementSize", () => {
  it("scales width and height of rects, progress bars and images with a 5px floor", () => {
    const rect = el({ type: "rect", width: 100, height: 50 });
    scaleElementSize(rect, 2, 0.01, welcomeProfile);
    expect(rect.width).toBe(200);
    expect(rect.height).toBe(5);
    const bar = el({ type: "progressbar", width: 100, height: 20 });
    scaleElementSize(bar, 1.5, 1.5, rankCardProfile);
    expect([bar.width, bar.height]).toEqual([150, 30]);
  });

  it("scales circles, triangles and stars through scaleX/scaleY", () => {
    const circle = el({ type: "circle", scaleX: 2 });
    scaleElementSize(circle, 3, 4, welcomeProfile);
    expect([circle.scaleX, circle.scaleY]).toEqual([6, 4]);
  });

  it("uses the profile's avatar radius when the element has none", () => {
    const a = el({ type: "avatar" });
    scaleElementSize(a, 2, 2, welcomeProfile);
    expect(a.radius).toBe(128);
    const b = el({ type: "avatar" });
    scaleElementSize(b, 2, 2, rankCardProfile);
    expect(b.radius).toBe(112);
  });

  it("scales text by the mean factor with a 6px floor and lines per axis", () => {
    const text = el({ type: "text", fontSize: 24 });
    scaleElementSize(text, 0.1, 0.1, welcomeProfile);
    expect(text.fontSize).toBe(6);
    const line = el({ type: "line", points: [-60, 0, 60, 0] });
    scaleElementSize(line, 2, 3, welcomeProfile);
    expect(line.points).toEqual([-120, 0, 120, 0]);
  });
});

describe("elementLabel / elementTypeIcon", () => {
  it("labels text by its content and other kinds by their name", () => {
    expect(elementLabel(el({ type: "text", text: "Hello world, this is long" }))).toBe("Hello world, thi");
    expect(elementLabel(el({ type: "text" }))).toBe("Text");
    expect(elementLabel(el({ type: "circle" }))).toBe("Circle");
    expect(elementLabel(el({ type: "progressbar" }))).toBe("XP Progress");
  });

  it("has an icon for every kind", () => {
    for (const type of ["text", "progressbar", "rect", "circle", "avatar", "image", "triangle", "star", "line"]) {
      expect(elementTypeIcon(type)).toMatch(/^i-/);
    }
  });

  it("falls back to a generic icon for unknown kinds", () => {
    expect(elementTypeIcon("nope")).toBe("i-lucide-layers");
  });
});

describe("previewText", () => {
  it("fills the welcome sample values", () => {
    expect(previewText("Hi {username} from {server_name} #{member_count}", welcomeProfile)).toBe(
      "Hi NewUser from My Server #42",
    );
  });

  it("fills the rank card sample values", () => {
    expect(previewText("{displayName} L{level} {progress_percent}", rankCardProfile)).toBe("Alex Johnson L14 65%");
  });
});
