<template>
  <div class="ce-prop-section">
    <p class="ce-prop-title">Avatar Shape</p>
    <div class="flex gap-1">
      <button
        class="ce-tool-btn-sm flex-1"
        :aria-pressed="(selectedElement.avatarShape ?? 'circle') === 'circle'"
        aria-label="Circle"
        @click="selectedElement.avatarShape = 'circle'"
      >
        <UIcon name="i-lucide-circle" class="text-sm" />
      </button>
      <button
        class="ce-tool-btn-sm flex-1"
        :aria-pressed="selectedElement.avatarShape === 'square'"
        aria-label="Square"
        @click="selectedElement.avatarShape = 'square'"
      >
        <UIcon name="i-lucide-square" class="text-sm" />
      </button>
    </div>
    <div
      v-if="selectedElement.avatarShape === 'square'"
      class="ce-prop-row mt-1.5"
    >
      <span class="ce-prop-label">Corner Radius</span>
      <input
        aria-label="Avatar corner radius"
        v-model.number="selectedElement.avatarCornerRadius"
        type="number"
        class="ce-num-input w-full"
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
