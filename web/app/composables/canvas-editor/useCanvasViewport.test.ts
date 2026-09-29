import { describe, expect, it } from "vitest";
import { computeScale } from "./useCanvasViewport";

describe("computeScale", () => {
  it("fits a 700x500 box before the stage area is measured", () => {
    expect(computeScale(null, 1000, 500, 1)).toBe(0.7);
    expect(computeScale(null, 600, 400, 1)).toBe(1);
  });

  it("keeps 40px of margin on every side when shrinking to fit", () => {
    // 597x897 stage (both panels open): width binds, (597 - 80) / 1000.
    expect(computeScale({ width: 597, height: 897 }, 1000, 500, 1)).toBeCloseTo(0.517, 10);
    // 1000x400 stage: height binds, (400 - 80) / 500.
    expect(computeScale({ width: 1000, height: 400 }, 1000, 500, 1)).toBeCloseTo(0.64, 10);
  });

  it("never enlarges a canvas that already fits", () => {
    expect(computeScale({ width: 1500, height: 900 }, 934, 282, 1)).toBe(1);
  });

  it("applies the zoom on top of the fitted scale", () => {
    expect(computeScale({ width: 597, height: 897 }, 1000, 500, 1.5)).toBeCloseTo(0.7755, 10);
    expect(computeScale({ width: 1500, height: 900 }, 934, 282, 0.25)).toBe(0.25);
  });

  it("refits when the stage area grows, e.g. a side panel collapses", () => {
    const open = computeScale({ width: 597, height: 897 }, 1000, 500, 1);
    const collapsed = computeScale({ width: 885, height: 897 }, 1000, 500, 1);
    expect(collapsed).toBeCloseTo(0.805, 10);
    expect(collapsed).toBeGreaterThan(open);
  });
});
