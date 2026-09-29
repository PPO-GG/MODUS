import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import { useCanvasHistory } from "./useCanvasHistory";
import type { CanvasTemplate } from "../../utils/canvas-editor/types";

const make = (): CanvasTemplate => ({ canvasWidth: 100, canvasHeight: 50, backgroundColor: "#000", elements: [] });

type History = ReturnType<typeof useCanvasHistory>;
const created: History[] = [];

/** Builds a history over a fresh template and remembers it for afterEach cleanup. */
function setup(onRestore?: () => void) {
  const template = ref(make());
  const h = useCanvasHistory(template, (next) => { template.value = next; }, onRestore);
  created.push(h);
  return { template, h };
}

describe("useCanvasHistory", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Clears any debounce timer a deep-watch edit left running.
    for (const h of created.splice(0)) h.dispose();
    vi.useRealTimers();
  });

  it("records snapshots, undoes and redoes", () => {
    const { template, h } = setup();
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
    const { template, h } = setup();
    h.reset();
    h.captureSnapshot();
    expect(h.undoStack.value.length).toBe(1);
    template.value.canvasWidth = 150;
    h.captureSnapshot();
    h.undo();
    expect(h.canRedo.value).toBe(true);
    template.value.canvasHeight = 60;
    h.captureSnapshot();
    expect(h.canRedo.value).toBe(false);
  });

  it("caps the history at 50 entries", () => {
    const { template, h } = setup();
    h.reset();
    for (let i = 1; i <= 60; i++) {
      template.value.canvasWidth = 100 + i;
      h.captureSnapshot();
    }
    expect(h.undoStack.value.length).toBe(50);
  });

  it("debounces snapshots taken from deep edits", async () => {
    const { template, h } = setup();
    h.reset();
    template.value.canvasWidth = 300;
    await nextTick();
    expect(h.undoStack.value.length).toBe(1);
    vi.advanceTimersByTime(500);
    expect(h.undoStack.value.length).toBe(2);
  });

  it("flushPendingSnapshot snapshots immediately and clears the pending timer", async () => {
    const { template, h } = setup();
    h.reset();
    template.value.canvasWidth = 300;
    await nextTick();
    expect(h.undoStack.value.length).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    h.flushPendingSnapshot();
    expect(h.undoStack.value.length).toBe(2);
    expect(JSON.parse(h.undoStack.value[1]!).canvasWidth).toBe(300);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("flushPendingSnapshot does nothing when no edit is pending", () => {
    const { h } = setup();
    h.reset();
    h.flushPendingSnapshot();
    expect(h.undoStack.value.length).toBe(1);
  });

  it("calls onRestore after undo and redo but not when there is nothing to restore", () => {
    const onRestore = vi.fn();
    const { template, h } = setup(onRestore);
    h.reset();
    h.undo();
    h.redo();
    expect(onRestore).not.toHaveBeenCalled();
    template.value.canvasWidth = 200;
    h.captureSnapshot();
    h.undo();
    expect(onRestore).toHaveBeenCalledTimes(1);
    h.redo();
    expect(onRestore).toHaveBeenCalledTimes(2);
  });

  it("dispose clears a pending debounce timer so no snapshot lands later", async () => {
    const { template, h } = setup();
    h.reset();
    template.value.canvasWidth = 300;
    await nextTick();
    expect(vi.getTimerCount()).toBe(1);
    h.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(h.undoStack.value.length).toBe(1);
  });
});
