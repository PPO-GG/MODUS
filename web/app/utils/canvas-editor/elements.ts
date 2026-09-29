import type { CanvasProfile } from "./profile";
import type { CanvasElement } from "./types";

export const MAX_IMAGE_LAYERS = 10;

export function imageLayerCount(elements: CanvasElement[]): number {
  return elements.filter((el) => el.type === "image").length;
}

/** Applies a group-scale factor to one element, in place. Mirrors the editors' original behaviour. */
export function scaleElementSize(el: CanvasElement, sx: number, sy: number, profile: CanvasProfile): void {
  switch (el.type) {
    case "rect":
    case "progressbar":
    case "image":
      el.width = Math.round(Math.max(5, (el.width ?? 100) * sx));
      el.height = Math.round(Math.max(5, (el.height ?? 100) * sy));
      break;
    case "circle":
    case "triangle":
    case "star":
      el.scaleX = (el.scaleX ?? 1) * sx;
      el.scaleY = (el.scaleY ?? 1) * sy;
      break;
    case "avatar":
      el.radius = Math.round(
        Math.max(5, (el.radius ?? profile.fallback.avatarRadius) * ((sx + sy) / 2)),
      );
      break;
    case "text":
      el.fontSize = Math.round(Math.max(6, (el.fontSize ?? 24) * ((sx + sy) / 2)));
      break;
    case "line":
      el.points = (el.points ?? [-60, 0, 60, 0]).map((p, i) => Math.round(i % 2 === 0 ? p * sx : p * sy));
      break;
  }
}

export function elementLabel(el: CanvasElement): string {
  if (el.type === "text") return (el.text || "Text").substring(0, 16);
  if (el.type === "progressbar") return "XP Progress";
  return el.type.charAt(0).toUpperCase() + el.type.slice(1);
}

export function elementTypeIcon(type: string): string {
  const map: Record<string, string> = {
    text: "i-lucide-type",
    progressbar: "i-lucide-chart-bar",
    rect: "i-lucide-square",
    circle: "i-lucide-circle",
    avatar: "i-lucide-circle-user",
    image: "i-lucide-image",
    triangle: "i-lucide-triangle",
    star: "i-lucide-star",
    line: "i-lucide-minus",
  };
  return map[type] || "i-lucide-layers";
}

export function previewText(text: string, profile: CanvasProfile): string {
  return profile.sample.reduce((out, [pattern, value]) => out.replace(pattern, value), text);
}
