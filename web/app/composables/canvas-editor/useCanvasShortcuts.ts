import { onMounted, onUnmounted, type Ref } from "vue";

/**
 * Window keyboard shortcuts for the editor: Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z
 * redo, Delete/Backspace delete, Space to pan and Shift for rotation snaps.
 * The held-key and panning flags are owned by the editor and passed in.
 */
export function useCanvasShortcuts(opts: {
  undo: () => void;
  redo: () => void;
  deleteSelectedElement: () => void;
  stageRef: Ref<any>;
  isSpaceHeld: Ref<boolean>;
  isShiftHeld: Ref<boolean>;
  isPanning: Ref<boolean>;
}) {
  const {
    undo,
    redo,
    deleteSelectedElement,
    stageRef,
    isSpaceHeld,
    isShiftHeld,
    isPanning,
  } = opts;

  function handleKeyDown(e: KeyboardEvent) {
    // Shift is a pure modifier with no side effects when typing (unlike Space,
    // which must reach text inputs), so track it before the input-focus guard:
    // rotation-snap should still work even if a properties-panel input happens
    // to still have focus.
    if (e.key === "Shift" && !isShiftHeld.value) {
      isShiftHeld.value = true;
    }

    // Don't intercept native text-editing (including the browser's own
    // undo/redo) while the user is typing in a field.
    const target = e.target as HTMLElement;
    const isTextEntry =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable;
    if (isTextEntry) return;

    // Undo/redo should fire even when a toolbar button (e.g. the Undo/Redo
    // buttons themselves) holds focus, so check it before the button-focus
    // guard below: only text entry should suppress it.
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }

    // Don't intercept when a focused control needs Space for its own native
    // activation (buttons, [role="button"]).
    if (target.closest("button, [role='button']")) return;

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteSelectedElement();
    }
    if (e.key === " " && !isSpaceHeld.value) {
      e.preventDefault();
      isSpaceHeld.value = true;
      stageRef.value?.getNode()?.listening(false);
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    if (e.key === "Shift") isShiftHeld.value = false;
    if (e.key === " ") {
      isSpaceHeld.value = false;
      isPanning.value = false;
      stageRef.value?.getNode()?.listening(true);
    }
  }

  function handleWindowBlur() {
    isShiftHeld.value = false;
    isSpaceHeld.value = false;
    isPanning.value = false;
    stageRef.value?.getNode()?.listening(true);
  }

  onMounted(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", handleWindowBlur);
  });

  return { handleKeyDown, handleKeyUp, handleWindowBlur };
}
