<template>
  <div class="rce-prop-section">
    <p class="rce-prop-title">Shadow</p>
    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
      <div class="rce-prop-row">
        <span class="rce-prop-label">Color</span>
        <input
          :value="selectedElement.shadowColor || '#000000'"
          type="color"
          class="rce-color-chip-lg cursor-pointer"
          @input="
            selectedElement.shadowColor = (
              $event.target as HTMLInputElement
            ).value
          "
        />
      </div>
      <div class="rce-prop-row">
        <span class="rce-prop-label">Blur</span>
        <input
          v-model.number="selectedElement.shadowBlur"
          type="number"
          class="rce-num-input w-full"
          min="0"
        />
      </div>
      <div class="rce-prop-row">
        <span class="rce-prop-label">X offset</span>
        <input
          v-model.number="selectedElement.shadowOffsetX"
          type="number"
          class="rce-num-input w-full"
        />
      </div>
      <div class="rce-prop-row">
        <span class="rce-prop-label">Y offset</span>
        <input
          v-model.number="selectedElement.shadowOffsetY"
          type="number"
          class="rce-num-input w-full"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  selectedElement,
} = useCanvasEditorContext();
</script>
