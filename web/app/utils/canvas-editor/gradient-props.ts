import {
  gradientType,
  parseGradientAngle,
  parseGradientStops,
} from "../gradient";

export function gradientFillProps(
  fill: string | undefined,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  defaultColor: string,
) {
  const type = gradientType(fill);
  if (!type) return { fill: fill || defaultColor };

  const stops = parseGradientStops(fill!);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  if (type === "linear") {
    const angle = parseGradientAngle(fill!);
    const rad = (angle * Math.PI) / 180;
    const hw = (maxX - minX) / 2;
    const hh = (maxY - minY) / 2;
    return {
      fill: undefined,
      fillLinearGradientStartPoint: {
        x: cx - Math.cos(rad) * hw,
        y: cy - Math.sin(rad) * hh,
      },
      fillLinearGradientEndPoint: {
        x: cx + Math.cos(rad) * hw,
        y: cy + Math.sin(rad) * hh,
      },
      fillLinearGradientColorStops: stops,
    };
  }

  const r = Math.max(maxX - minX, maxY - minY) / 2;
  return {
    fill: undefined,
    fillRadialGradientStartPoint: { x: cx, y: cy },
    fillRadialGradientEndPoint: { x: cx, y: cy },
    fillRadialGradientStartRadius: 0,
    fillRadialGradientEndRadius: r,
    fillRadialGradientColorStops: stops,
  };
}

export function gradientStrokeProps(
  stroke: string | undefined,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
) {
  const type = gradientType(stroke);
  if (!type) return { stroke };

  const stops = parseGradientStops(stroke!);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  if (type === "linear") {
    const angle = parseGradientAngle(stroke!);
    const rad = (angle * Math.PI) / 180;
    const hw = (maxX - minX) / 2;
    const hh = (maxY - minY) / 2;
    return {
      stroke: undefined,
      strokeLinearGradientStartPoint: {
        x: cx - Math.cos(rad) * hw,
        y: cy - Math.sin(rad) * hh,
      },
      strokeLinearGradientEndPoint: {
        x: cx + Math.cos(rad) * hw,
        y: cy + Math.sin(rad) * hh,
      },
      strokeLinearGradientColorStops: stops,
    };
  }

  const r = Math.max(maxX - minX, maxY - minY) / 2;
  return {
    stroke: undefined,
    strokeRadialGradientStartPoint: { x: cx, y: cy },
    strokeRadialGradientEndPoint: { x: cx, y: cy },
    strokeRadialGradientStartRadius: 0,
    strokeRadialGradientEndRadius: r,
    strokeRadialGradientColorStops: stops,
  };
}
