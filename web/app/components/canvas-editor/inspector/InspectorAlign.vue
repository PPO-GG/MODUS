<template>
  <div class="rce-prop-section">
    <p class="rce-prop-title">Align</p>
    <div class="grid grid-cols-6 gap-1">
      <UTooltip text="Align left">
        <button
          class="rce-tool-btn-sm"
          aria-label="Align left"
          @click="alignLayers('left')"
        >
          <UIcon name="i-lucide-align-start-vertical" class="text-sm" />
        </button>
      </UTooltip>
      <UTooltip text="Align center">
        <button
          class="rce-tool-btn-sm"
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
          class="rce-tool-btn-sm"
          aria-label="Align right"
          @click="alignLayers('right')"
        >
          <UIcon name="i-lucide-align-end-vertical" class="text-sm" />
        </button>
      </UTooltip>
      <UTooltip text="Align top">
        <button
          class="rce-tool-btn-sm"
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
          class="rce-tool-btn-sm"
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
          class="rce-tool-btn-sm"
          aria-label="Align bottom"
          @click="alignLayers('bottom')"
        >
          <UIcon name="i-lucide-align-end-horizontal" class="text-sm" />
        </button>
      </UTooltip>
    </div>
    <div class="grid grid-cols-2 gap-1 mt-1">
      <UTooltip text="Distribute horizontally">
        <button
          class="rce-tool-btn-sm !w-full"
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
          class="rce-tool-btn-sm !w-full"
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
