import { describe, expect, it } from "vitest";
import { gradientFillProps, gradientStrokeProps } from "./gradient-props";

describe("gradientFillProps", () => {
  it("passes a solid colour through, falling back to the default", () => {
    expect(gradientFillProps("#123456", 0, 0, 10, 10, "#fff")).toEqual({ fill: "#123456" });
    expect(gradientFillProps(undefined, 0, 0, 10, 10, "#fff")).toEqual({ fill: "#fff" });
  });

  it("maps a linear gradient onto the bounding box along its angle", () => {
    const props = gradientFillProps("linear-gradient(0deg, #000000, #ffffff)", 0, 0, 100, 50, "#fff") as any;
    expect(props.fill).toBeUndefined();
    expect(props.fillLinearGradientStartPoint).toEqual({ x: 0, y: 25 });
    expect(props.fillLinearGradientEndPoint).toEqual({ x: 100, y: 25 });
    expect(props.fillLinearGradientColorStops).toEqual([0, "#000000", 1, "#ffffff"]);
  });

  it("centres a radial gradient", () => {
    const props = gradientFillProps("radial-gradient(#000000, #ffffff)", 0, 0, 100, 50, "#fff") as any;
    expect(props.fillRadialGradientStartPoint).toEqual({ x: 50, y: 25 });
    expect(props.fillRadialGradientEndRadius).toBe(50);
  });
});

describe("gradientStrokeProps", () => {
  it("passes a solid stroke through and builds stroke gradients", () => {
    expect(gradientStrokeProps("#111", 0, 0, 10, 10)).toEqual({ stroke: "#111" });
    const props = gradientStrokeProps("linear-gradient(90deg, #000000, #ffffff)", 0, 0, 100, 100) as any;
    expect(props.stroke).toBeUndefined();
    expect(props.strokeLinearGradientColorStops).toEqual([0, "#000000", 1, "#ffffff"]);
  });
});
