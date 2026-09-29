<template>
  <div class="rce-prop-section">
    <p class="rce-prop-title">Avatar Shape</p>
    <div class="flex gap-1">
      <button
        class="rce-tool-btn-sm flex-1"
        :class="{
          'rce-layer-active':
            (selectedElement.avatarShape ?? 'circle') === 'circle',
        }"
        aria-label="Circle"
        @click="selectedElement.avatarShape = 'circle'"
      >
        <UIcon name="i-heroicons-sun" class="text-sm" />
      </button>
      <button
        class="rce-tool-btn-sm flex-1"
        :class="{
          'rce-layer-active': selectedElement.avatarShape === 'square',
        }"
        aria-label="Square"
        @click="selectedElement.avatarShape = 'square'"
      >
        <UIcon name="i-heroicons-stop" class="text-sm" />
      </button>
    </div>
    <div
      v-if="selectedElement.avatarShape === 'square'"
      class="rce-prop-row mt-1.5"
    >
      <span class="rce-prop-label">Corner Radius</span>
      <input
        v-model.number="selectedElement.avatarCornerRadius"
        type="number"
        class="rce-num-input w-full"
        min="0"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  selectedElement,
} = useCanvasEditorContext();
</script>
