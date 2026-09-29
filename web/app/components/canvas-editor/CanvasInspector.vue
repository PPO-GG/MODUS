<template>
  <div class="w-72 shrink-0 rce-glass-panel rounded-2xl overflow-y-auto">
    <!-- Single Selection Properties -->
    <div v-if="selectedElement" class="flex flex-col">
      <!-- Header -->
      <div
        class="flex items-center justify-between p-2 border-b border-white/10"
      >
        <div class="flex items-center gap-1.5">
          <UIcon
            :name="elementTypeIcon(selectedElement.type)"
            class="text-sm text-secondary-400"
          />
          <span class="text-xs font-medium text-zinc-200">
            {{ elementLabel(selectedElement) }}
          </span>
        </div>
        <UTooltip text="Delete element">
          <button
            class="rce-tool-btn text-red-400 hover:text-red-300"
            aria-label="Delete element"
            @click="deleteSelectedElement"
          >
            <UIcon name="i-heroicons-trash" class="text-sm" />
          </button>
        </UTooltip>
      </div>

      <!-- Alignment Suite -->
      <InspectorAlign />

      <!-- Transform (Position & Sizing) -->
      <InspectorTransform />

      <!-- Typography / Text Section -->
      <InspectorTypography v-if="selectedElement.type === 'text'" />

      <!-- Progress Bar Specifics -->
      <InspectorProgressBar
        v-if="
          profile.tools.some((t) => t.type === 'progressbar') &&
          selectedElement.type === 'progressbar'
        "
      />

      <!-- Custom Image -->
      <InspectorImage v-if="selectedElement.type === 'image'" />

      <!-- Shadow / Glow -->
      <InspectorShadow
        v-if="profile.shadow === 'all' || selectedElement.type === 'image'"
      />

      <!-- Fill & Gradient Picker -->
      <InspectorFill
        v-if="
          selectedElement.type !== 'avatar' &&
          (selectedElement.type !== 'image' ||
            profile.images.isTintableSvg(selectedElement.src)) &&
          selectedElement.type !== 'line'
        "
      />

      <!-- Stroke & Gradient Picker -->
      <InspectorStroke
        v-if="
          selectedElement.type !== 'avatar' &&
          selectedElement.type !== 'image' &&
          selectedElement.type !== 'progressbar'
        "
      />

      <!-- Avatar Shape & Border -->
      <InspectorAvatarShape v-if="selectedElement.type === 'avatar'" />

      <InspectorAvatarBorder v-if="selectedElement.type === 'avatar'" />

      <!-- Opacity Slider -->
      <InspectorOpacity />
    </div>

    <!-- Multi-Selection Properties -->
    <div v-else-if="selectedElementIds.size > 1" class="flex flex-col">
      <!-- Header -->
      <div
        class="flex items-center justify-between p-2 border-b border-white/10"
      >
        <span class="text-xs font-medium text-zinc-300">
          {{ selectedElementIds.size }} layers selected
        </span>
        <div class="flex items-center gap-1">
          <UTooltip text="Duplicate selection">
            <button
              class="rce-tool-btn"
              aria-label="Duplicate selection"
              @click="duplicateSelectedElement"
            >
              <UIcon
                name="i-heroicons-document-duplicate"
                class="text-sm"
              />
            </button>
          </UTooltip>
          <UTooltip text="Delete selection">
            <button
              class="rce-tool-btn text-red-400 hover:text-red-300"
              aria-label="Delete selection"
              @click="deleteSelectedElement"
            >
              <UIcon name="i-heroicons-trash" class="text-sm" />
            </button>
          </UTooltip>
        </div>
      </div>

      <!-- Align Suite for Multi-Selection -->
      <InspectorAlign />

      <!-- Group Transform -->
      <InspectorGroupTransform />
    </div>

    <!-- No Selection Empty State -->
    <div
      v-else
      class="flex flex-col items-center justify-center h-full text-center py-12"
    >
      <UIcon
        name="i-heroicons-cursor-arrow-rays"
        class="text-2xl text-zinc-600 mb-2"
      />
      <p class="text-xs text-zinc-500">Select an element on canvas</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";
import InspectorAlign from "~/components/canvas-editor/inspector/InspectorAlign.vue";
import InspectorTransform from "~/components/canvas-editor/inspector/InspectorTransform.vue";
import InspectorTypography from "~/components/canvas-editor/inspector/InspectorTypography.vue";
import InspectorProgressBar from "~/components/canvas-editor/inspector/InspectorProgressBar.vue";
import InspectorImage from "~/components/canvas-editor/inspector/InspectorImage.vue";
import InspectorShadow from "~/components/canvas-editor/inspector/InspectorShadow.vue";
import InspectorFill from "~/components/canvas-editor/inspector/InspectorFill.vue";
import InspectorStroke from "~/components/canvas-editor/inspector/InspectorStroke.vue";
import InspectorAvatarShape from "~/components/canvas-editor/inspector/InspectorAvatarShape.vue";
import InspectorAvatarBorder from "~/components/canvas-editor/inspector/InspectorAvatarBorder.vue";
import InspectorOpacity from "~/components/canvas-editor/inspector/InspectorOpacity.vue";
import InspectorGroupTransform from "~/components/canvas-editor/inspector/InspectorGroupTransform.vue";

const {
  profile,
  selectedElementIds,
  selectedElement,
  deleteSelectedElement,
  duplicateSelectedElement,
  elementLabel,
  elementTypeIcon,
} = useCanvasEditorContext();
</script>
