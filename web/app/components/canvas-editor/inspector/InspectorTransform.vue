<template>
  <div class="ce-prop-section">
    <p class="ce-prop-title">Transform</p>
    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
      <div class="ce-prop-row">
        <span class="ce-prop-label">X</span>
        <input
          aria-label="X"
          v-model.number="selectedElement.x"
          type="number"
          class="ce-num-input w-full"
        />
      </div>
      <div class="ce-prop-row">
        <span class="ce-prop-label">Y</span>
        <input
          aria-label="Y"
          v-model.number="selectedElement.y"
          type="number"
          class="ce-num-input w-full"
        />
      </div>
      <div class="ce-prop-row">
        <span class="ce-prop-label">Rotation</span>
        <input
          aria-label="Rotation"
          v-model.number="selectedElement.rotation"
          type="number"
          class="ce-num-input w-full"
        />
      </div>
      <template
        v-if="
          selectedElement.type === 'rect' ||
          selectedElement.type === 'progressbar' ||
          selectedElement.type === 'image'
        "
      >
        <div class="ce-prop-row">
          <span class="ce-prop-label">W</span>
          <input
            aria-label="Width"
            v-model.number="selectedElement.width"
            type="number"
            class="ce-num-input w-full"
          />
        </div>
        <div class="ce-prop-row">
          <span class="ce-prop-label">H</span>
          <input
            aria-label="Height"
            v-model.number="selectedElement.height"
            type="number"
            class="ce-num-input w-full"
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
        <div class="ce-prop-row">
          <span class="ce-prop-label">R</span>
          <input
            aria-label="Radius"
            v-model.number="selectedElement.radius"
            type="number"
            class="ce-num-input w-full"
          />
        </div>
      </template>
      <template v-if="selectedElement.type === 'star'">
        <div class="ce-prop-row">
          <span class="ce-prop-label">Outer</span>
          <input
            aria-label="Outer"
            v-model.number="selectedElement.outerRadius"
            type="number"
            class="ce-num-input w-full"
          />
        </div>
        <div class="ce-prop-row">
          <span class="ce-prop-label">Inner</span>
          <input
            aria-label="Inner"
            v-model.number="selectedElement.innerRadius"
            type="number"
            class="ce-num-input w-full"
          />
        </div>
        <div class="ce-prop-row">
          <span class="ce-prop-label">Points</span>
          <input
            aria-label="Points"
            v-model.number="selectedElement.numPoints"
            type="number"
            class="ce-num-input w-full"
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
        class="ce-prop-row col-span-2"
      >
        <span class="ce-prop-label">Corner Radius</span>
        <input
          aria-label="Corner Radius"
          v-model.number="selectedElement.cornerRadius"
          type="number"
          class="ce-num-input w-full"
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
