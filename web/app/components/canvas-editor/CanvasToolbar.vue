<template>
  <div class="ce-toolbar ce-panel">
    <!-- Tools and layers panel toggle -->
    <UTooltip :text="leftPanelLabel">
      <UButton
        :icon="
          leftPanelOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'
        "
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="leftPanelLabel"
        :aria-expanded="leftPanelOpen"
        :aria-controls="leftPanelId"
        @click="toggleLeftPanel"
      />
    </UTooltip>

    <div class="ce-toolbar-sep" />

    <!-- Canvas Settings: deselect so the inspector shows size, background and templates -->
    <div class="ce-toolbar-group">
      <UTooltip text="Canvas settings">
        <UButton
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-lucide-maximize"
          :label="`${template.canvasWidth} × ${template.canvasHeight}`"
          aria-label="Canvas settings"
          @click="showCanvasSettings"
        />
      </UTooltip>
    </div>

    <div class="flex-1" />

    <!-- Undo / Redo / Reset / Save -->
    <div class="ce-toolbar-group">
      <UTooltip text="Undo (Ctrl+Z)">
        <UButton
          icon="i-lucide-undo-2"
          color="neutral"
          variant="ghost"
          size="xs"
          label="Undo"
          aria-label="Undo"
          :disabled="!canUndo"
          @click="undo"
        />
      </UTooltip>
      <UTooltip text="Redo (Ctrl+Shift+Z)">
        <UButton
          icon="i-lucide-redo-2"
          color="neutral"
          variant="ghost"
          size="xs"
          label="Redo"
          aria-label="Redo"
          :disabled="!canRedo"
          @click="redo"
        />
      </UTooltip>
      <UTooltip text="Reset to the default design">
        <UButton
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="ghost"
          size="xs"
          label="Reset"
          aria-label="Reset"
          @click="resetTemplate"
        />
      </UTooltip>
    </div>

    <div class="ce-toolbar-sep" />

    <!-- Inspector panel toggle -->
    <UTooltip :text="rightPanelLabel">
      <UButton
        :icon="
          rightPanelOpen
            ? 'i-lucide-panel-right-close'
            : 'i-lucide-panel-right-open'
        "
        color="neutral"
        variant="ghost"
        size="xs"
        :aria-label="rightPanelLabel"
        :aria-expanded="rightPanelOpen"
        :aria-controls="rightPanelId"
        @click="toggleRightPanel"
      />
    </UTooltip>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  template,
  selectedElementIds,
  canUndo,
  canRedo,
  undo,
  redo,
  resetTemplate,
  leftPanelOpen,
  rightPanelOpen,
  leftPanelId,
  rightPanelId,
  toggleLeftPanel,
  toggleRightPanel,
} = useCanvasEditorContext();

const leftPanelLabel = computed(() =>
  leftPanelOpen.value
    ? "Hide tools and layers panel"
    : "Show tools and layers panel",
);
const rightPanelLabel = computed(() =>
  rightPanelOpen.value ? "Hide inspector" : "Show inspector",
);

/** Clears the selection; the inspector then shows the canvas settings. */
function showCanvasSettings() {
  selectedElementIds.value = new Set();
}
</script>
