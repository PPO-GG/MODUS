import { computed, ref, watch, type Ref } from "vue";
import type { CanvasTemplate } from "../../utils/canvas-editor/types";

/**
 * Undo/redo for a canvas design: JSON snapshots taken 500 ms after the last
 * deep edit, capped at 50, with redo cleared by any new edit.
 */
export function useCanvasHistory(
  template: Ref<CanvasTemplate>,
  replaceTemplate: (next: CanvasTemplate) => void,
  onRestore?: () => void,
) {
  const undoStack = ref<string[]>([]);
  const redoStack = ref<string[]>([]);
  const HISTORY_LIMIT = 50;
  let historyTimer: ReturnType<typeof setTimeout> | null = null;

  function captureSnapshot() {
    const json = JSON.stringify(template.value);
    if (undoStack.value[undoStack.value.length - 1] === json) return;
    undoStack.value.push(json);
    if (undoStack.value.length > HISTORY_LIMIT) undoStack.value.shift();
    redoStack.value = [];
  }

  watch(
    template,
    () => {
      if (historyTimer) clearTimeout(historyTimer);
      historyTimer = setTimeout(captureSnapshot, 500);
    },
    { deep: true },
  );

  function flushPendingSnapshot() {
    if (historyTimer) {
      clearTimeout(historyTimer);
      historyTimer = null;
      captureSnapshot();
    }
  }

  function undo() {
    flushPendingSnapshot();
    if (undoStack.value.length <= 1) return;
    const current = undoStack.value.pop()!;
    redoStack.value.push(current);
    const prev = undoStack.value[undoStack.value.length - 1]!;
    replaceTemplate(JSON.parse(prev));
    onRestore?.();
  }

  function redo() {
    flushPendingSnapshot();
    if (redoStack.value.length === 0) return;
    const next = redoStack.value.pop()!;
    undoStack.value.push(next);
    replaceTemplate(JSON.parse(next));
    onRestore?.();
  }

  const canUndo = computed(() => undoStack.value.length > 1);
  const canRedo = computed(() => redoStack.value.length > 0);

  /** Starts a fresh history from the current template (used once loaded). */
  function reset() {
    undoStack.value = [JSON.stringify(template.value)];
    redoStack.value = [];
  }

  function dispose() {
    if (historyTimer) clearTimeout(historyTimer);
  }

  return { undoStack, redoStack, canUndo, canRedo, undo, redo, captureSnapshot, flushPendingSnapshot, reset, dispose };
}
