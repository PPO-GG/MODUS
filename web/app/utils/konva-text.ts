import type Konva from "konva";

/**
 * Re-measure every Konva.Text on the stage, then redraw.
 *
 * Konva measures text when a text attr changes and caches the result, so a
 * node created (or re-fonted) before its web font finished loading keeps the
 * fallback font's metrics — wrong width, wrapping and selection box — even
 * though a plain batchDraw paints the right glyphs.
 */
export function remeasureText(stage: Konva.Stage | null | undefined): void {
  if (!stage) return;
  // _setTextData is Konva's internal re-measure; no public API re-runs it
  // without changing an attr.
  stage.find("Text").forEach((node) => (node as any)._setTextData());
  stage.batchDraw();
}
