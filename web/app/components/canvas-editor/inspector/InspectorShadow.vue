<template>
  <div class="ce-prop-section">
    <!-- Titled by the "Shadow" group header in CanvasInspector. -->
    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
      <div class="ce-prop-row">
        <span class="ce-prop-label">Color</span>
        <input
          aria-label="Shadow color"
          :value="selectedElement.shadowColor || '#000000'"
          type="color"
          class="ce-color-chip-lg cursor-pointer"
          @input="
            selectedElement.shadowColor = (
              $event.target as HTMLInputElement
            ).value
          "
        />
      </div>
      <div class="ce-prop-row">
        <span class="ce-prop-label">Blur</span>
        <input
          aria-label="Shadow blur"
          v-model.number="selectedElement.shadowBlur"
          type="number"
          class="ce-num-input w-full"
          min="0"
        />
      </div>
      <div class="ce-prop-row">
        <span class="ce-prop-label">X offset</span>
        <input
          aria-label="Shadow X offset"
          v-model.number="selectedElement.shadowOffsetX"
          type="number"
          class="ce-num-input w-full"
        />
      </div>
      <div class="ce-prop-row">
        <span class="ce-prop-label">Y offset</span>
        <input
          aria-label="Shadow Y offset"
          v-model.number="selectedElement.shadowOffsetY"
          type="number"
          class="ce-num-input w-full"
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
