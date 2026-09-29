<template>
  <div class="rce-prop-section">
    <p class="rce-prop-title">Group Transform</p>
    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
      <div class="rce-prop-row">
        <span class="rce-prop-label">X</span>
        <input
          :value="Math.round(groupBounds?.x ?? 0)"
          type="number"
          class="rce-num-input w-full"
          @change="
            (e: any) =>
              applyGroupMove(
                Number(e.target.value),
                groupBounds?.y ?? 0,
              )
          "
        />
      </div>
      <div class="rce-prop-row">
        <span class="rce-prop-label">Y</span>
        <input
          :value="Math.round(groupBounds?.y ?? 0)"
          type="number"
          class="rce-num-input w-full"
          @change="
            (e: any) =>
              applyGroupMove(
                groupBounds?.x ?? 0,
                Number(e.target.value),
              )
          "
        />
      </div>
      <div class="rce-prop-row">
        <span class="rce-prop-label">W</span>
        <input
          :value="Math.round(groupBounds?.width ?? 0)"
          type="number"
          min="1"
          class="rce-num-input w-full"
          @change="
            (e: any) =>
              applyGroupScale(
                Number(e.target.value),
                groupBounds?.height ?? 1,
              )
          "
        />
      </div>
      <div class="rce-prop-row">
        <span class="rce-prop-label">H</span>
        <input
          :value="Math.round(groupBounds?.height ?? 0)"
          type="number"
          min="1"
          class="rce-num-input w-full"
          @change="
            (e: any) =>
              applyGroupScale(
                groupBounds?.width ?? 1,
                Number(e.target.value),
              )
          "
        />
      </div>
      <div class="rce-prop-row col-span-2">
        <span class="rce-prop-label">Rotation</span>
        <input
          v-model.number.lazy="groupRotationDelta"
          type="number"
          class="rce-num-input w-full"
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
