<template>
  <div class="rce-prop-section">
    <p class="rce-prop-title">Fill</p>
    <UPopover>
      <button
        type="button"
        class="rce-color-chip-lg cursor-pointer"
        :style="{ background: swatchPreview(selectedElement.fill) }"
      />
      <template #content>
        <GradientPicker
          :model-value="selectedElement.fill"
          :allow-gradient="
            selectedElement.type !== 'text' &&
            selectedElement.type !== 'image'
          "
          @update:model-value="
            (v: string) => {
              if (selectedElement) selectedElement.fill = v;
            }
          "
        />
      </template>
    </UPopover>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  selectedElement,
  swatchPreview,
} = useCanvasEditorContext();
</script>
