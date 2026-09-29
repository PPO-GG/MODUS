import type { CanvasElement, CanvasElementType, CanvasTemplate } from "./types";

export interface CanvasTool {
  type: CanvasElementType;
  icon: string;
  label: string;
  /** Tailwind text colour tinting the tool's icon (a per-type identity colour). */
  color: string;
}

export interface CanvasPreset {
  name: string;
  /** CSS background for the preset thumbnail. */
  preview: string;
  template: CanvasTemplate;
}

export interface CanvasProfile {
  id: "welcome" | "rank-card";
  /** Used in limit toasts, e.g. "welcome template". */
  noun: string;
  /** Prefix for console warnings, e.g. "[Welcome image editor]". */
  logPrefix: string;
  tools: CanvasTool[];
  presets: CanvasPreset[];
  defaultTemplate: () => CanvasTemplate;
  /** Variables offered in the text layer's "Insert variable" menu. */
  placeholders: string[];
  /** Placeholder text of the text layer's field. */
  textHint: string;
  /** Substitutions applied to text layers so the canvas shows sample values. */
  sample: [RegExp, string][];
  /** "all": every element can cast a shadow. "image": only image layers. */
  shadow: "all" | "image";
  /** Values used when an element leaves a property unset. */
  fallback: {
    rectFill: string;
    circleFill: string;
    starFill: string;
    lineStroke: string;
    textAlign: "left" | "center";
    avatarRadius: number;
    avatarBorder: string;
  };
  /** Initial properties for a newly added element, or undefined for an unknown kind. */
  newElement: (type: CanvasElementType, cx: number, cy: number) => Partial<CanvasElement> | undefined;
  uploads: { background: string; image: string };
  images: {
    isTintableSvg: (source: unknown) => source is string;
    tintRasterSize: (
      intrinsicWidth: number,
      intrinsicHeight: number,
      renderedWidth: number,
      renderedHeight: number,
    ) => { width: number; height: number };
    renderKey: (
      id: string,
      source: string,
      fill?: string,
      width?: number,
      height?: number,
    ) => string;
  };
}
