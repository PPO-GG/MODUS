import { computed, onMounted, onUnmounted, ref, type Ref } from "vue";
import type { CanvasTemplate } from "~/utils/canvas-editor/types";

/** The stage area's client size, in CSS pixels. */
export interface WrapSize {
  width: number;
  height: number;
}

/**
 * Display scale for the canvas: shrinks it to fit the stage area with 40px of
 * margin on every side (never enlarges it), then applies the user's zoom.
 * Before the area has been measured it fits a 700x500 box.
 */
export function computeScale(
  wrap: WrapSize | null,
  canvasWidth: number,
  canvasHeight: number,
  zoom: number,
): number {
  const maxW = wrap ? wrap.width - 80 : 700;
  const maxH = wrap ? wrap.height - 80 : 500;
  const sw = canvasWidth > maxW ? maxW / canvasWidth : 1;
  const sh = canvasHeight > maxH ? maxH / canvasHeight : 1;
  const baseScale = Math.min(sw, sh, 1);
  return baseScale * zoom;
}

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

  // offsetWidth/offsetHeight aren't reactive, so a ResizeObserver mirrors
  // them here: the canvas refits when a side panel collapses or the window
  // resizes, not only when the zoom or the design changes.
  const wrapSize = ref<WrapSize | null>(null);
  let resizeObserver: ResizeObserver | null = null;

  // Offset size (border box) rather than client size: the wrapper is
  // overflow-auto, and on classic space-taking scrollbars a scrollbar
  // appearing shrinks clientWidth/clientHeight, which changes the fit scale,
  // which changes the overflow, and can flicker in a narrow zoom band. The
  // stage has no border, so on overlay-scrollbar systems the two are
  // identical.
  function measureWrap() {
    const el = canvasWrap.value;
    if (!el) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (wrapSize.value?.width === width && wrapSize.value?.height === height)
      return;
    wrapSize.value = { width, height };
  }

  onMounted(() => {
    measureWrap();
    if (!canvasWrap.value || typeof ResizeObserver === "undefined") return;
    resizeObserver = new ResizeObserver(measureWrap);
    resizeObserver.observe(canvasWrap.value);
  });

  onUnmounted(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
  });

  const scaleFactor = computed(() =>
    computeScale(
      wrapSize.value,
      template.value.canvasWidth,
      template.value.canvasHeight,
      zoomMultiplier.value,
    ),
  );

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
