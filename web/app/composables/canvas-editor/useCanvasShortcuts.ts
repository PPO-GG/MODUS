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
    if (e.key === "Shift" && !isShiftHeld.value) {
      isShiftHeld.value = true;
    }

    const target = e.target as HTMLElement;
    const isTextEntry =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable;
    if (isTextEntry) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }

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
