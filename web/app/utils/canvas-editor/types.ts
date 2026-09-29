import type { RankCardElement, RankCardTemplate } from "../rank-cards";

// The rank-card element model is a superset of the welcome one (it adds
// `progressbar`), so it is the shared shape. Profiles decide which kinds exist.
export type CanvasElement = RankCardElement;
export type CanvasTemplate = RankCardTemplate;
export type CanvasElementType = CanvasElement["type"];

export type AlignDirection = "left" | "center-h" | "right" | "top" | "middle-v" | "bottom";
