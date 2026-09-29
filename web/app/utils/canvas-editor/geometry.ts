import type { AlignDirection } from "./types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function unionRect(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function alignDelta(
  direction: AlignDirection,
  bounds: Rect,
  rect: Rect,
): { dx: number; dy: number } {
  switch (direction) {
    case "left":
      return { dx: bounds.x - rect.x, dy: 0 };
    case "center-h":
      return {
        dx: bounds.x + bounds.width / 2 - (rect.x + rect.width / 2),
        dy: 0,
      };
    case "right":
      return {
        dx: bounds.x + bounds.width - (rect.x + rect.width),
        dy: 0,
      };
    case "top":
      return { dx: 0, dy: bounds.y - rect.y };
    case "middle-v":
      return {
        dx: 0,
        dy: bounds.y + bounds.height / 2 - (rect.y + rect.height / 2),
      };
    case "bottom":
      return {
        dx: 0,
        dy: bounds.y + bounds.height - (rect.y + rect.height),
      };
  }
}

/** Movement (rounded) that evens the gaps between three or more items; the outermost two stay put. */
export function distributeDeltas(
  axis: "horizontal" | "vertical",
  items: { id: string; rect: Rect }[],
): Map<string, number> {
  const deltas = new Map<string, number>();
  if (items.length < 3) return deltas;
  const key = axis === "horizontal" ? "x" : "y";
  const sizeKey = axis === "horizontal" ? "width" : "height";
  const sorted = [...items].sort((a, b) => a.rect[key] - b.rect[key]);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const totalSpan = last.rect[key] + last.rect[sizeKey] - first.rect[key];
  const totalSize = sorted.reduce((sum, i) => sum + i.rect[sizeKey], 0);
  const gap = (totalSpan - totalSize) / (sorted.length - 1);
  let cursor = first.rect[key] + first.rect[sizeKey] + gap;
  for (let i = 1; i < sorted.length - 1; i++) {
    const { id, rect } = sorted[i]!;
    deltas.set(id, Math.round(cursor - rect[key]));
    cursor += rect[sizeKey] + gap;
  }
  return deltas;
}

export function rotateAround(
  x: number,
  y: number,
  cx: number,
  cy: number,
  deg: number,
): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad),
    sin = Math.sin(rad);
  const relX = x - cx,
    relY = y - cy;
  return { x: cx + relX * cos - relY * sin, y: cy + relX * sin + relY * cos };
}
