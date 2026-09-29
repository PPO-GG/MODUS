<template>
  <div class="rce-prop-section">
    <p class="rce-prop-title">Image</p>
    <UButton
      label="Replace image"
      color="neutral"
      variant="outline"
      block
      @click="
        replacingImageId = selectedElement!.id;
        imageUploadInput?.click();
      "
    />
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  selectedElement,
  imageUploadInput,
  replacingImageId,
} = useCanvasEditorContext();
</script>
