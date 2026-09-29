<template>
  <div class="ce-prop-section">
    <p class="ce-prop-title">Progress Track</p>
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="ce-prop-label">Track Color</span>
        <UPopover>
          <button
            type="button"
            class="ce-color-chip-lg cursor-pointer"
            aria-label="Track color"
            :style="{
              background: swatchPreview(
                selectedElement.trackColor || 'rgba(255,255,255,0.08)',
              ),
            }"
          />
          <template #content>
            <GradientPicker
              :model-value="
                selectedElement.trackColor || 'rgba(255,255,255,0.08)'
              "
              :allow-radial="false"
              @update:model-value="
                (v: string) => {
                  if (selectedElement) selectedElement.trackColor = v;
                }
              "
            />
          </template>
        </UPopover>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  selectedElement,
  swatchPreview,
} = useCanvasEditorContext();
</script>
