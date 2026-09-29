<template>
  <div class="flex flex-col">
    <p class="px-2.5 py-2 border-b border-white/10 text-[11px] text-gray-500">
      Select a layer on the canvas to edit it.
    </p>

    <!-- Canvas Dimensions -->
    <div class="ce-prop-section">
      <p class="ce-prop-title">Canvas</p>
      <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <div class="ce-prop-row">
          <span class="ce-prop-label">Width</span>
          <UInputNumber
            v-model="template.canvasWidth"
            :min="200"
            :max="1920"
            size="sm"
            class="w-full"
          />
        </div>
        <div class="ce-prop-row">
          <span class="ce-prop-label">Height</span>
          <UInputNumber
            v-model="template.canvasHeight"
            :min="100"
            :max="1080"
            size="sm"
            class="w-full"
          />
        </div>
      </div>
    </div>

    <!-- Background Color & Image -->
    <div class="ce-prop-section">
      <p class="ce-prop-title">Background</p>
      <div class="space-y-2">
        <div class="ce-prop-row">
          <span class="ce-prop-label">Color</span>
          <div class="flex items-center gap-2">
            <UPopover>
              <button
                type="button"
                class="ce-color-chip-lg cursor-pointer"
                aria-label="Background color"
                :style="{ background: template.backgroundColor }"
              />
              <template #content>
                <div class="p-3">
                  <UColorPicker v-model="template.backgroundColor" size="sm" />
                </div>
              </template>
            </UPopover>
            <UInput
              v-model="template.backgroundColor"
              size="xs"
              class="font-mono flex-1"
            />
          </div>
        </div>
        <div class="ce-prop-row">
          <span class="ce-prop-label">Image</span>
          <div class="flex items-center gap-2">
            <UFileUpload
              v-model="bgImageFile"
              accept="image/*"
              :dropzone="false"
              :preview="false"
            >
              <template #default="{ open }">
                <UButton
                  icon="i-lucide-image"
                  color="neutral"
                  variant="outline"
                  size="xs"
                  :label="template.backgroundImage ? 'Replace' : 'Upload'"
                  @click="open()"
                />
              </template>
            </UFileUpload>
            <UButton
              v-if="template.backgroundImage"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Remove background image"
              @click="removeBgImage"
            />
            <span
              v-if="bgUploading"
              class="text-[10px] text-gray-500 flex items-center gap-1"
            >
              <UIcon
                name="i-lucide-loader-circle"
                class="animate-spin text-xs"
              />
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Preset Templates -->
    <div class="ce-prop-section">
      <p class="ce-prop-title">Templates</p>
      <div class="grid grid-cols-2 gap-1">
        <UTooltip
          v-for="preset in profile.presets"
          :key="preset.name"
          :text="preset.name"
        >
          <button class="ce-preset-btn" @click="applyPreset(preset)">
            <div
              class="ce-preset-swatch"
              :style="{ background: preset.preview }"
            />
            <span class="text-[9px] truncate text-gray-300">{{
              preset.name
            }}</span>
          </button>
        </UTooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  profile,
  template,
  applyPreset,
  bgImageFile,
  bgUploading,
  removeBgImage,
} = useCanvasEditorContext();
</script>
