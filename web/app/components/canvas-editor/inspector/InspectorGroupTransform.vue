<template>
  <div class="ce-prop-section">
    <p class="ce-prop-title">Group Transform</p>
    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
      <div class="ce-prop-row">
        <span class="ce-prop-label">X</span>
        <input
          aria-label="Group X"
          :value="Math.round(groupBounds?.x ?? 0)"
          type="number"
          class="ce-num-input w-full"
          @change="
            (e: any) =>
              applyGroupMove(
                Number(e.target.value),
                groupBounds?.y ?? 0,
              )
          "
        />
      </div>
      <div class="ce-prop-row">
        <span class="ce-prop-label">Y</span>
        <input
          aria-label="Group Y"
          :value="Math.round(groupBounds?.y ?? 0)"
          type="number"
          class="ce-num-input w-full"
          @change="
            (e: any) =>
              applyGroupMove(
                groupBounds?.x ?? 0,
                Number(e.target.value),
              )
          "
        />
      </div>
      <div class="ce-prop-row">
        <span class="ce-prop-label">W</span>
        <input
          aria-label="Group width"
          :value="Math.round(groupBounds?.width ?? 0)"
          type="number"
          min="1"
          class="ce-num-input w-full"
          @change="
            (e: any) =>
              applyGroupScale(
                Number(e.target.value),
                groupBounds?.height ?? 1,
              )
          "
        />
      </div>
      <div class="ce-prop-row">
        <span class="ce-prop-label">H</span>
        <input
          aria-label="Group height"
          :value="Math.round(groupBounds?.height ?? 0)"
          type="number"
          min="1"
          class="ce-num-input w-full"
          @change="
            (e: any) =>
              applyGroupScale(
                groupBounds?.width ?? 1,
                Number(e.target.value),
              )
          "
        />
      </div>
      <div class="ce-prop-row col-span-2">
        <span class="ce-prop-label">Rotation</span>
        <input
          aria-label="Group rotation"
          v-model.number.lazy="groupRotationDelta"
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
  groupBounds,
  groupRotationDelta,
  applyGroupMove,
  applyGroupScale,
} = useCanvasEditorContext();
</script>
