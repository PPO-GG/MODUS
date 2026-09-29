<template>
  <div class="ce-prop-section">
    <p class="ce-prop-title">Avatar Border</p>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="ce-color-chip-lg"
        aria-label="Border color"
        :style="{
          background: selectedElement.borderColor || profile.fallback.avatarBorder,
        }"
        @click="($refs.borderColor as HTMLInputElement).click()"
      />
      <input
        ref="borderColor"
        type="color"
        v-model="selectedElement.borderColor"
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
      />
      <input
        v-model.number="selectedElement.borderWidth"
        type="number"
        aria-label="Border width"
        class="ce-num-input w-14"
        min="0"
        placeholder="0"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  profile,
  selectedElement,
} = useCanvasEditorContext();
</script>
