<template>
  <div class="rce-prop-section">
    <p class="rce-prop-title">Text</p>
    <textarea
      ref="textFieldRef"
      v-model="selectedElement.text"
      rows="2"
      class="rce-textarea"
      :placeholder="profile.textHint"
    />
    <div class="flex flex-wrap gap-1 mt-2">
      <button
        v-for="ph in profile.placeholders"
        :key="ph"
        class="rce-placeholder-chip"
        @click="insertPlaceholder(ph)"
      >
        {{ ph }}
      </button>
    </div>

    <!-- Font Family -->
    <div class="mt-2">
      <span class="rce-prop-label block mb-1">Font</span>
      <FontPicker
        :model-value="selectedElement.fontFamily || 'sans-serif'"
        @update:model-value="handleFontChange"
      />
    </div>

    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1.5">
      <div class="rce-prop-row">
        <span class="rce-prop-label">Size</span>
        <input
          v-model.number="selectedElement.fontSize"
          type="number"
          class="rce-num-input w-full"
          min="6"
        />
      </div>
      <div class="rce-prop-row">
        <span class="rce-prop-label">Style</span>
        <select
          v-model="selectedElement.fontStyle"
          class="rce-select w-full"
        >
          <option value="">Normal</option>
          <option value="bold">Bold</option>
          <option value="italic">Italic</option>
          <option value="bold italic">B+I</option>
        </select>
      </div>
    </div>

    <!-- Justification Buttons -->
    <div class="flex gap-1 mt-1.5">
      <button
        v-for="a in ['left', 'center', 'right']"
        :key="a"
        class="rce-tool-btn flex-1"
        :class="{
          'bg-secondary-600/30 text-secondary-300':
            selectedElement.align === a,
        }"
        @click="selectedElement!.align = a"
      >
        <UIcon
          :name="
            a === 'left'
              ? 'i-heroicons-bars-3-bottom-left'
              : a === 'center'
                ? 'i-heroicons-bars-3'
                : 'i-heroicons-bars-3-bottom-right'
          "
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  profile,
  selectedElement,
  textFieldRef,
  insertPlaceholder,
  handleFontChange,
} = useCanvasEditorContext();
</script>
