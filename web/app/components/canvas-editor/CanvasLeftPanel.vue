<template>
  <div class="w-72 shrink-0 flex flex-col rounded-2xl">
    <!-- Preset Themes -->
    <div class="p-2 border-b border-white/10">
      <p class="rce-panel-label mb-2">Presets</p>
      <div class="grid grid-cols-2 gap-1">
        <UTooltip
          v-for="preset in profile.presets"
          :key="preset.name"
          :text="preset.name"
        >
          <button class="rce-preset-btn" @click="applyPreset(preset)">
            <div
              class="rce-preset-swatch"
              :style="{ background: preset.preview }"
            />
            <span class="text-[9px] truncate text-zinc-300">{{
              preset.name
            }}</span>
          </button>
        </UTooltip>
      </div>
    </div>

    <!-- Add Element Tools -->
    <div class="p-2 border-b border-white/10">
      <p class="rce-panel-label mb-2">Tools</p>
      <div class="flex flex-col gap-1.5">
        <button
          v-for="t in profile.tools"
          :key="t.type"
          class="rce-tool-row"
          @click="
            t.type === 'image'
              ? imageUploadInput?.click()
              : addElement(t.type)
          "
        >
          <UIcon :name="t.icon" class="text-lg shrink-0" :class="t.color" />
          <span class="text-sm font-medium">{{ t.label }}</span>
        </button>
      </div>
      <input
        ref="imageUploadInput"
        type="file"
        accept="image/*"
        class="sr-only"
        @change="handleImageFileSelection"
        @cancel="replacingImageId = null"
      />
    </div>

    <!-- Layers List -->
    <div class="flex-1 flex flex-col min-h-0">
      <div
        class="flex items-center justify-between p-2 border-b border-white/10"
      >
        <p class="rce-panel-label">Layers</p>
        <div class="flex items-center gap-1">
          <UTooltip text="Move up">
            <button
              class="rce-tool-btn-sm"
              :aria-disabled="selectedElementIds.size !== 1"
              aria-label="Move up"
              @click="moveLayer('up')"
            >
              <UIcon name="i-heroicons-chevron-up" class="text-sm" />
            </button>
          </UTooltip>
          <UTooltip text="Move down">
            <button
              class="rce-tool-btn-sm"
              :aria-disabled="selectedElementIds.size !== 1"
              aria-label="Move down"
              @click="moveLayer('down')"
            >
              <UIcon name="i-heroicons-chevron-down" class="text-sm" />
            </button>
          </UTooltip>
          <UTooltip text="Duplicate">
            <button
              class="rce-tool-btn-sm"
              :aria-disabled="selectedElementIds.size === 0"
              aria-label="Duplicate"
              @click="duplicateSelectedElement"
            >
              <UIcon
                name="i-heroicons-document-duplicate"
                class="text-sm"
              />
            </button>
          </UTooltip>
          <UTooltip text="Delete">
            <button
              class="rce-tool-btn-sm text-red-400 hover:text-red-300"
              :aria-disabled="selectedElementIds.size === 0"
              aria-label="Delete"
              @click="deleteSelectedElement"
            >
              <UIcon name="i-heroicons-trash" class="text-sm" />
            </button>
          </UTooltip>
          <span class="text-[10px] text-zinc-500 tabular-nums ml-1">
            {{ template.elements.length }}
          </span>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-1 space-y-px">
        <div
          v-if="template.elements.length === 0"
          class="text-center py-8 text-zinc-600 text-[11px]"
        >
          Add elements using the tools above
        </div>
        <button
          v-for="(el, index) in reversedElements"
          :key="el.id"
          class="rce-layer"
          :class="{ 'rce-layer-active': selectedElementIds.has(el.id) }"
          @click="(e: MouseEvent) => selectElement(el.id, e)"
          @mouseenter="hoveredElementId = el.id"
          @mouseleave="hoveredElementId = null"
        >
          <UIcon
            :name="elementTypeIcon(el.type)"
            class="text-sm shrink-0"
          />
          <span class="truncate flex-1 text-left">
            {{ elementLabel(el) }}
          </span>
          <span class="text-[9px] text-zinc-600 tabular-nums">
            {{ template.elements.length - index }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  profile,
  template,
  reversedElements,
  selectedElementIds,
  hoveredElementId,
  selectElement,
  imageUploadInput,
  applyPreset,
  replacingImageId,
  handleImageFileSelection,
  addElement,
  deleteSelectedElement,
  duplicateSelectedElement,
  moveLayer,
  elementLabel,
  elementTypeIcon,
} = useCanvasEditorContext();
</script>
