import { describe, expect, it } from "vitest";
import { alignDelta, distributeDeltas, rotateAround, unionRect } from "./geometry";

const r = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe("unionRect", () => {
  it("returns the bounding box, or null for nothing", () => {
    expect(unionRect([r(10, 20, 30, 40), r(0, 50, 5, 5)])).toEqual(r(0, 20, 40, 40));
    expect(unionRect([])).toBeNull();
  });
});

describe("alignDelta", () => {
  const bounds = r(0, 0, 100, 100);
  const rect = r(10, 20, 30, 40);
  it("aligns each edge and centre", () => {
    expect(alignDelta("left", bounds, rect)).toEqual({ dx: -10, dy: 0 });
    expect(alignDelta("center-h", bounds, rect)).toEqual({ dx: 25, dy: 0 });
    expect(alignDelta("right", bounds, rect)).toEqual({ dx: 60, dy: 0 });
    expect(alignDelta("top", bounds, rect)).toEqual({ dx: 0, dy: -20 });
    expect(alignDelta("middle-v", bounds, rect)).toEqual({ dx: 0, dy: 10 });
    expect(alignDelta("bottom", bounds, rect)).toEqual({ dx: 0, dy: 40 });
  });
});

describe("distributeDeltas", () => {
  it("evens the gaps between the outer items and leaves them in place", () => {
    const deltas = distributeDeltas("horizontal", [
      { id: "a", rect: r(0, 0, 10, 10) },
      { id: "b", rect: r(12, 0, 10, 10) },
      { id: "c", rect: r(90, 0, 10, 10) },
    ]);
    expect([...deltas.keys()]).toEqual(["b"]);
    expect(deltas.get("b")).toBe(33);
  });

  it("does nothing for fewer than three items", () => {
    expect(distributeDeltas("vertical", [{ id: "a", rect: r(0, 0, 1, 1) }]).size).toBe(0);
  });

  it("orders by position, not input order", () => {
    const deltas = distributeDeltas("vertical", [
      { id: "c", rect: r(0, 90, 10, 10) },
      { id: "a", rect: r(0, 0, 10, 10) },
      { id: "b", rect: r(0, 12, 10, 10) },
    ]);
    expect([...deltas.keys()]).toEqual(["b"]);
  });
});

describe("rotateAround", () => {
  it("rotates a point about a centre", () => {
    const p = rotateAround(10, 0, 0, 0, 90);
    expect(Math.round(p.x)).toBe(0);
    expect(Math.round(p.y)).toBe(10);
  });
});
