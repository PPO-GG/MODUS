<template>
  <div class="ce-prop-section">
    <p class="ce-prop-title">Stroke</p>
    <div class="flex items-center gap-2">
      <UPopover>
        <button
          type="button"
          class="ce-color-chip-lg cursor-pointer"
          aria-label="Stroke color"
          :style="{ background: swatchPreview(selectedElement.stroke) }"
        />
        <template #content>
          <GradientPicker
            :model-value="selectedElement.stroke"
            :allow-radial="false"
            :allow-gradient="
              selectedElement.type !== 'text' &&
              selectedElement.type !== 'line'
            "
            @update:model-value="
              (v: string) => {
                if (selectedElement) selectedElement.stroke = v;
              }
            "
          />
        </template>
      </UPopover>
      <input
        v-model.number="selectedElement.strokeWidth"
        type="number"
        aria-label="Stroke width"
        class="ce-num-input w-14"
        min="0"
        placeholder="0"
      />
    </div>
    <UCheckbox
      v-if="selectedElement.type === 'line'"
      v-model="selectedElement.arrow"
      label="Arrowhead"
      class="mt-2"
    />
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  selectedElement,
  swatchPreview,
} = useCanvasEditorContext();
</script>
