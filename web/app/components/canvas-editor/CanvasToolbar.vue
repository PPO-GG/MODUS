<template>
  <div class="rce-toolbar rce-glass-panel rounded-2xl">
    <!-- Canvas Dimensions Popover -->
    <div class="rce-toolbar-group">
      <UPopover>
        <UTooltip text="Canvas size">
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            icon="i-heroicons-arrows-pointing-out"
            :label="`${template.canvasWidth} × ${template.canvasHeight}`"
            aria-label="Canvas size"
          />
        </UTooltip>
        <template #content>
          <div class="p-3 space-y-3 w-48">
            <div>
              <p class="rce-prop-label mb-1">Width</p>
              <UInputNumber
                v-model="template.canvasWidth"
                :min="200"
                :max="1920"
                size="sm"
                class="w-full"
              />
            </div>
            <div>
              <p class="rce-prop-label mb-1">Height</p>
              <UInputNumber
                v-model="template.canvasHeight"
                :min="100"
                :max="1080"
                size="sm"
                class="w-full"
              />
            </div>
          </div>
        </template>
      </UPopover>
    </div>

    <div class="rce-toolbar-sep" />

    <!-- Background Color & Image -->
    <div class="rce-toolbar-group">
      <UPopover>
        <UTooltip text="Background">
          <UButton
            color="neutral"
            variant="outline"
            size="xs"
            aria-label="Background"
            :style="{ backgroundColor: template.backgroundColor }"
            class="w-6 h-6 p-0 rounded-md relative"
          >
            <UIcon
              v-if="template.backgroundImage"
              name="i-heroicons-photo"
              class="text-[10px] text-white drop-shadow"
            />
          </UButton>
        </UTooltip>
        <template #content>
          <div class="p-3 space-y-3 w-56">
            <div>
              <p class="rce-prop-label mb-1.5">Color</p>
              <div class="space-y-2">
                <UColorPicker v-model="template.backgroundColor" size="sm" />
                <UInput
                  v-model="template.backgroundColor"
                  size="xs"
                  class="font-mono w-full"
                />
              </div>
            </div>
            <div class="border-t border-white/10 pt-3">
              <p class="rce-prop-label mb-1.5">Image</p>
              <div class="flex items-center gap-2">
                <UFileUpload
                  v-model="bgImageFile"
                  accept="image/*"
                  :dropzone="false"
                  :preview="false"
                >
                  <template #default="{ open }">
                    <UButton
                      icon="i-heroicons-photo"
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
                  icon="i-heroicons-x-mark"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="Remove background image"
                  @click="removeBgImage"
                />
                <span
                  v-if="bgUploading"
                  class="text-[10px] text-zinc-500 flex items-center gap-1"
                >
                  <UIcon
                    name="i-heroicons-arrow-path"
                    class="animate-spin text-xs"
                  />
                </span>
              </div>
            </div>
          </div>
        </template>
      </UPopover>
    </div>

    <div class="rce-toolbar-sep" />

    <!-- Zoom Controls -->
    <div class="rce-toolbar-group">
      <span class="rce-label">Zoom</span>
      <span class="text-xs text-zinc-400 tabular-nums w-10 text-center">
        {{ Math.round(zoomMultiplier * 100) }}%
      </span>
      <UTooltip text="Reset zoom">
        <UButton
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-heroicons-arrow-path"
          aria-label="Reset zoom"
          @click="zoomMultiplier = 1"
        />
      </UTooltip>
    </div>

    <div class="flex-1" />

    <!-- Undo / Redo / Reset / Save -->
    <div class="rce-toolbar-group">
      <UTooltip text="Undo (Ctrl+Z)">
        <UButton
          icon="i-heroicons-arrow-uturn-left"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Undo"
          :disabled="!canUndo"
          @click="undo"
        />
      </UTooltip>
      <UTooltip text="Redo (Ctrl+Shift+Z)">
        <UButton
          icon="i-heroicons-arrow-uturn-right"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Redo"
          :disabled="!canRedo"
          @click="redo"
        />
      </UTooltip>
      <UTooltip text="Reset">
        <UButton
          icon="i-heroicons-arrow-path"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="Reset"
          @click="resetTemplate"
        />
      </UTooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  template,
  zoomMultiplier,
  canUndo,
  canRedo,
  undo,
  redo,
  resetTemplate,
  bgImageFile,
  bgUploading,
  removeBgImage,
} = useCanvasEditorContext();
</script>
