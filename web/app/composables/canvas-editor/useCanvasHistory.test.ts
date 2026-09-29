import { describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { useCanvasHistory } from "./useCanvasHistory";
import type { CanvasTemplate } from "../../utils/canvas-editor/types";

const make = (): CanvasTemplate => ({ canvasWidth: 100, canvasHeight: 50, backgroundColor: "#000", elements: [] });

describe("useCanvasHistory", () => {
  it("records snapshots, undoes and redoes", () => {
    const template = ref(make());
    const h = useCanvasHistory(template, (next) => { template.value = next; });
    h.reset();
    template.value.canvasWidth = 200;
    h.captureSnapshot();
    expect(h.canUndo.value).toBe(true);
    h.undo();
    expect(template.value.canvasWidth).toBe(100);
    expect(h.canRedo.value).toBe(true);
    h.redo();
    expect(template.value.canvasWidth).toBe(200);
  });

  it("ignores identical snapshots and clears redo on a new edit", () => {
    const template = ref(make());
    const h = useCanvasHistory(template, (next) => { template.value = next; });
    h.reset();
    h.captureSnapshot();
    expect(h.undoStack.value.length).toBe(1);
    template.value.canvasWidth = 150;
    h.captureSnapshot();
    h.undo();
    template.value.canvasHeight = 60;
    h.captureSnapshot();
    expect(h.canRedo.value).toBe(false);
  });

  it("caps the history at 50 entries", () => {
    const template = ref(make());
    const h = useCanvasHistory(template, (next) => { template.value = next; });
    h.reset();
    for (let i = 1; i <= 60; i++) {
      template.value.canvasWidth = 100 + i;
      h.captureSnapshot();
    }
    expect(h.undoStack.value.length).toBe(50);
  });

  it("debounces snapshots taken from deep edits", async () => {
    vi.useFakeTimers();
    const template = ref(make());
    const h = useCanvasHistory(template, (next) => { template.value = next; });
    h.reset();
    template.value.canvasWidth = 300;
    await nextTick();
    expect(h.undoStack.value.length).toBe(1);
    vi.advanceTimersByTime(500);
    expect(h.undoStack.value.length).toBe(2);
    h.dispose();
    vi.useRealTimers();
  });
});
