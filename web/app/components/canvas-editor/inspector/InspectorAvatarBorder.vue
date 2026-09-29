<template>
  <div class="rce-prop-section">
    <p class="rce-prop-title">Avatar Border</p>
    <div class="flex items-center gap-2">
      <div
        class="rce-color-chip-lg"
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
      />
      <input
        v-model.number="selectedElement.borderWidth"
        type="number"
        class="rce-num-input w-14"
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
