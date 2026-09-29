<template>
  <div class="w-72 shrink-0 flex flex-col ce-sidebar-left">
    <!-- Add Element Tools -->
    <div class="p-2 border-b border-white/10 shrink-0">
      <p class="ce-panel-label mb-2">Tools</p>
      <div class="grid grid-cols-5 gap-1.5">
        <UTooltip v-for="t in profile.tools" :key="t.type" :text="t.label">
          <button
            type="button"
            class="ce-tool-tile"
            :aria-label="t.label"
            @click="
              t.type === 'image'
                ? imageUploadInput?.click()
                : addElement(t.type)
            "
          >
            <UIcon :name="t.icon" class="text-lg" :class="t.color" />
          </button>
        </UTooltip>
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
        <p class="ce-panel-label">Layers</p>
        <div class="flex items-center gap-1">
          <UTooltip text="Move up">
            <button
              class="ce-tool-btn-sm"
              :aria-disabled="selectedElementIds.size !== 1"
              aria-label="Move up"
              @click="moveLayer('up')"
            >
              <UIcon name="i-lucide-chevron-up" class="text-sm" />
            </button>
          </UTooltip>
          <UTooltip text="Move down">
            <button
              class="ce-tool-btn-sm"
              :aria-disabled="selectedElementIds.size !== 1"
              aria-label="Move down"
              @click="moveLayer('down')"
            >
              <UIcon name="i-lucide-chevron-down" class="text-sm" />
            </button>
          </UTooltip>
          <UTooltip text="Duplicate">
            <button
              class="ce-tool-btn-sm"
              :aria-disabled="selectedElementIds.size === 0"
              aria-label="Duplicate"
              @click="duplicateSelectedElement"
            >
              <UIcon
                name="i-lucide-copy"
                class="text-sm"
              />
            </button>
          </UTooltip>
          <UTooltip text="Delete">
            <button
              class="ce-tool-btn-sm text-red-400 hover:text-red-300"
              :aria-disabled="selectedElementIds.size === 0"
              aria-label="Delete"
              @click="deleteSelectedElement"
            >
              <UIcon name="i-lucide-trash-2" class="text-sm" />
            </button>
          </UTooltip>
          <span class="text-[10px] text-gray-500 tabular-nums ml-1">
            {{ template.elements.length }}
          </span>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-1 space-y-px">
        <div
          v-if="template.elements.length === 0"
          class="text-center py-8 text-gray-600 text-[11px]"
        >
          Add elements using the tools above
        </div>
        <button
          v-for="(el, index) in reversedElements"
          :key="el.id"
          class="ce-layer"
          :class="{ 'ce-layer-active': selectedElementIds.has(el.id) }"
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
          <span class="text-[9px] text-gray-600 tabular-nums">
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
