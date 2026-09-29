<template>
  <div
    v-if="selectedElementIds.size > 0"
    class="ce-floating ce-selection-bar"
    role="group"
    aria-label="Align selection"
  >
    <UTooltip text="Align left">
      <button
        class="ce-tool-btn-sm"
        aria-label="Align left"
        @click="alignLayers('left')"
      >
        <UIcon name="i-lucide-align-start-vertical" class="text-sm" />
      </button>
    </UTooltip>
    <UTooltip text="Align center">
      <button
        class="ce-tool-btn-sm"
        aria-label="Align center"
        @click="alignLayers('center-h')"
      >
        <UIcon
          name="i-lucide-align-center-vertical"
          class="text-sm"
        />
      </button>
    </UTooltip>
    <UTooltip text="Align right">
      <button
        class="ce-tool-btn-sm"
        aria-label="Align right"
        @click="alignLayers('right')"
      >
        <UIcon name="i-lucide-align-end-vertical" class="text-sm" />
      </button>
    </UTooltip>
    <UTooltip text="Align top">
      <button
        class="ce-tool-btn-sm"
        aria-label="Align top"
        @click="alignLayers('top')"
      >
        <UIcon
          name="i-lucide-align-start-horizontal"
          class="text-sm"
        />
      </button>
    </UTooltip>
    <UTooltip text="Align middle">
      <button
        class="ce-tool-btn-sm"
        aria-label="Align middle"
        @click="alignLayers('middle-v')"
      >
        <UIcon
          name="i-lucide-align-center-horizontal"
          class="text-sm"
        />
      </button>
    </UTooltip>
    <UTooltip text="Align bottom">
      <button
        class="ce-tool-btn-sm"
        aria-label="Align bottom"
        @click="alignLayers('bottom')"
      >
        <UIcon name="i-lucide-align-end-horizontal" class="text-sm" />
      </button>
    </UTooltip>

    <div class="ce-toolbar-sep" />

    <UTooltip text="Distribute horizontally">
      <button
        class="ce-tool-btn-sm"
        aria-label="Distribute horizontally"
        :aria-disabled="selectedElementIds.size < 3"
        @click="distributeLayers('horizontal')"
      >
        <UIcon
          name="i-lucide-align-horizontal-distribute-center"
          class="text-sm"
        />
      </button>
    </UTooltip>
    <UTooltip text="Distribute vertically">
      <button
        class="ce-tool-btn-sm"
        aria-label="Distribute vertically"
        :aria-disabled="selectedElementIds.size < 3"
        @click="distributeLayers('vertical')"
      >
        <UIcon
          name="i-lucide-align-vertical-distribute-center"
          class="text-sm"
        />
      </button>
    </UTooltip>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  selectedElementIds,
  alignLayers,
  distributeLayers,
} = useCanvasEditorContext();
</script>
