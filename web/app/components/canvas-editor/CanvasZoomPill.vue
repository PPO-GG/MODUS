<template>
  <div class="ce-floating ce-zoom-pill" role="group" aria-label="Zoom">
    <span class="ce-zoom-readout">
      {{ Math.round(zoomMultiplier * 100) }}%
    </span>
    <UTooltip text="Reset zoom">
      <button
        class="ce-tool-btn-sm"
        aria-label="Reset zoom"
        @click="zoomMultiplier = 1"
      >
        <UIcon name="i-lucide-scan" class="text-sm" />
      </button>
    </UTooltip>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const { zoomMultiplier } = useCanvasEditorContext();
</script>
