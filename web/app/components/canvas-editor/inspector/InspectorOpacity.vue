<template>
  <div class="rce-prop-section">
    <div class="flex items-center justify-between">
      <p class="rce-prop-title mb-0">Opacity</p>
      <span class="text-[10px] text-zinc-500 tabular-nums">
        {{ Math.round((selectedElement.opacity ?? 1) * 100) }}%
      </span>
    </div>
    <USlider
      v-model="selectedElementOpacityPct"
      :min="0"
      :max="100"
      :step="1"
      size="sm"
      class="mt-1"
    />
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  selectedElement,
  selectedElementOpacityPct,
} = useCanvasEditorContext();
</script>
