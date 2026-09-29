import { computed, ref, type Ref } from "vue";
import type { CanvasTemplate } from "~/utils/canvas-editor/types";

/**
 * Zoom and Space-drag panning for the editor's scrollable canvas area. The
 * Space/panning flags are owned by the editor and shared with the shortcuts.
 */
export function useCanvasViewport(opts: {
  canvasWrap: Ref<HTMLElement | null>;
  template: Ref<CanvasTemplate>;
  isSpaceHeld: Ref<boolean>;
  isPanning: Ref<boolean>;
}) {
  const { canvasWrap, template, isSpaceHeld, isPanning } = opts;

  const zoomMultiplier = ref(1);

  const scaleFactor = computed(() => {
    const maxW = canvasWrap.value ? canvasWrap.value.clientWidth - 80 : 700;
    const maxH = canvasWrap.value ? canvasWrap.value.clientHeight - 80 : 500;
    const sw =
      template.value.canvasWidth > maxW ? maxW / template.value.canvasWidth : 1;
    const sh =
      template.value.canvasHeight > maxH ? maxH / template.value.canvasHeight : 1;
    const baseScale = Math.min(sw, sh, 1);
    return baseScale * zoomMultiplier.value;
  });

  let panStart = { x: 0, y: 0, scrollLeft: 0, scrollTop: 0 };

  function handlePanStart(e: MouseEvent) {
    if (e.button !== 0 || !isSpaceHeld.value || !canvasWrap.value) return;
    isPanning.value = true;
    panStart = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: canvasWrap.value.scrollLeft,
      scrollTop: canvasWrap.value.scrollTop,
    };
  }

  function handlePanMove(e: MouseEvent) {
    if (!isPanning.value || !canvasWrap.value) return;
    if (e.buttons === 0) {
      handlePanEnd();
      return;
    }
    canvasWrap.value.scrollLeft = panStart.scrollLeft - (e.clientX - panStart.x);
    canvasWrap.value.scrollTop = panStart.scrollTop - (e.clientY - panStart.y);
  }

  function handlePanEnd() {
    isPanning.value = false;
  }

  const ZOOM_STEP = 0.1;
  const ZOOM_MIN = 0.25;
  const ZOOM_MAX = 3;

  function handleWheelZoom(e: WheelEvent) {
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    zoomMultiplier.value = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, Math.round((zoomMultiplier.value + delta) * 100) / 100),
    );
  }

  return {
    zoomMultiplier,
    scaleFactor,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    handleWheelZoom,
  };
}
