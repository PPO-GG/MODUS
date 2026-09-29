<template>
  <div class="rce-prop-section">
    <p class="rce-prop-title">Transform</p>
    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
      <div class="rce-prop-row">
        <span class="rce-prop-label">X</span>
        <input
          v-model.number="selectedElement.x"
          type="number"
          class="rce-num-input w-full"
        />
      </div>
      <div class="rce-prop-row">
        <span class="rce-prop-label">Y</span>
        <input
          v-model.number="selectedElement.y"
          type="number"
          class="rce-num-input w-full"
        />
      </div>
      <div class="rce-prop-row">
        <span class="rce-prop-label">Rotation</span>
        <input
          v-model.number="selectedElement.rotation"
          type="number"
          class="rce-num-input w-full"
        />
      </div>
      <template
        v-if="
          selectedElement.type === 'rect' ||
          selectedElement.type === 'progressbar' ||
          selectedElement.type === 'image'
        "
      >
        <div class="rce-prop-row">
          <span class="rce-prop-label">W</span>
          <input
            v-model.number="selectedElement.width"
            type="number"
            class="rce-num-input w-full"
          />
        </div>
        <div class="rce-prop-row">
          <span class="rce-prop-label">H</span>
          <input
            v-model.number="selectedElement.height"
            type="number"
            class="rce-num-input w-full"
          />
        </div>
      </template>
      <template
        v-if="
          selectedElement.type === 'circle' ||
          selectedElement.type === 'avatar' ||
          selectedElement.type === 'triangle'
        "
      >
        <div class="rce-prop-row">
          <span class="rce-prop-label">R</span>
          <input
            v-model.number="selectedElement.radius"
            type="number"
            class="rce-num-input w-full"
          />
        </div>
      </template>
      <template v-if="selectedElement.type === 'star'">
        <div class="rce-prop-row">
          <span class="rce-prop-label">Outer</span>
          <input
            v-model.number="selectedElement.outerRadius"
            type="number"
            class="rce-num-input w-full"
          />
        </div>
        <div class="rce-prop-row">
          <span class="rce-prop-label">Inner</span>
          <input
            v-model.number="selectedElement.innerRadius"
            type="number"
            class="rce-num-input w-full"
          />
        </div>
        <div class="rce-prop-row">
          <span class="rce-prop-label">Points</span>
          <input
            v-model.number="selectedElement.numPoints"
            type="number"
            class="rce-num-input w-full"
            min="3"
            max="12"
          />
        </div>
      </template>
      <div
        v-if="
          selectedElement.type === 'rect' ||
          selectedElement.type === 'progressbar'
        "
        class="rce-prop-row col-span-2"
      >
        <span class="rce-prop-label">Corner Radius</span>
        <input
          v-model.number="selectedElement.cornerRadius"
          type="number"
          class="rce-num-input w-full"
          min="0"
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
