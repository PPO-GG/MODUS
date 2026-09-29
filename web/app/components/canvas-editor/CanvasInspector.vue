<template>
  <div class="w-72 shrink-0 ce-sidebar-right overflow-y-auto">
    <!-- Single Selection Properties -->
    <div v-if="selectedElement" class="flex flex-col">
      <!-- Header -->
      <div
        class="flex items-center justify-between p-2 border-b border-white/10"
      >
        <div class="flex items-center gap-1.5">
          <UIcon
            :name="elementTypeIcon(selectedElement.type)"
            class="text-sm text-sky-200"
          />
          <span class="text-xs font-medium text-gray-200">
            {{ elementLabel(selectedElement) }}
          </span>
        </div>
        <UTooltip text="Delete element">
          <button
            class="ce-tool-btn text-red-400 hover:text-red-300"
            aria-label="Delete element"
            @click="deleteSelectedElement"
          >
            <UIcon name="i-lucide-trash-2" class="text-sm" />
          </button>
        </UTooltip>
      </div>

      <!-- Position & size (alignment floats over the canvas). The storage key
           keeps its old name so a viewer's remembered open state carries over. -->
      <InspectorGroup title="Position & size" storage-key="layout">
        <InspectorTransform />
      </InspectorGroup>

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

      <!-- Avatar Shape & Border -->
      <InspectorAvatarShape v-if="selectedElement.type === 'avatar'" />

      <InspectorAvatarBorder v-if="selectedElement.type === 'avatar'" />

      <!-- Appearance: Fill, Stroke, Opacity, Shadow -->
      <InspectorGroup title="Appearance" storage-key="appearance">
        <template #summary>
          <span
            v-if="hasFillSection && selectedElement.fill"
            class="ce-group-swatch"
            :style="{ background: swatchPreview(selectedElement.fill) }"
          />
          <span>{{ selectedElementOpacityPct }}%</span>
        </template>

        <!-- Fill & Gradient Picker -->
        <InspectorFill v-if="hasFillSection" />

        <!-- Stroke & Gradient Picker -->
        <InspectorStroke
          v-if="
            selectedElement.type !== 'avatar' &&
            selectedElement.type !== 'image' &&
            selectedElement.type !== 'progressbar'
          "
        />

        <!-- Opacity Slider -->
        <InspectorOpacity />

        <!-- Shadow / Glow -->
        <InspectorGroup
          v-if="profile.shadow === 'all' || selectedElement.type === 'image'"
          title="Shadow"
          storage-key="shadow"
          :default-open="false"
        >
          <InspectorShadow />
        </InspectorGroup>
      </InspectorGroup>
    </div>

    <!-- Multi-Selection Properties -->
    <div v-else-if="selectedElementIds.size > 1" class="flex flex-col">
      <!-- Header -->
      <div
        class="flex items-center justify-between p-2 border-b border-white/10"
      >
        <span class="text-xs font-medium text-gray-300">
          {{ selectedElementIds.size }} layers selected
        </span>
        <div class="flex items-center gap-1">
          <UTooltip text="Duplicate selection">
            <button
              class="ce-tool-btn"
              aria-label="Duplicate selection"
              @click="duplicateSelectedElement"
            >
              <UIcon
                name="i-lucide-copy"
                class="text-sm"
              />
            </button>
          </UTooltip>
          <UTooltip text="Delete selection">
            <button
              class="ce-tool-btn text-red-400 hover:text-red-300"
              aria-label="Delete selection"
              @click="deleteSelectedElement"
            >
              <UIcon name="i-lucide-trash-2" class="text-sm" />
            </button>
          </UTooltip>
        </div>
      </div>

      <!-- Position & size: Group Transform for Multi-Selection -->
      <InspectorGroup title="Position & size" storage-key="layout">
        <InspectorGroupTransform />
      </InspectorGroup>
    </div>

    <!-- No Selection: Canvas Settings -->
    <InspectorCanvas v-else />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";
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
import InspectorCanvas from "~/components/canvas-editor/inspector/InspectorCanvas.vue";
import InspectorGroup from "~/components/canvas-editor/inspector/InspectorGroup.vue";

const {
  profile,
  selectedElementIds,
  selectedElement,
  selectedElementOpacityPct,
  deleteSelectedElement,
  duplicateSelectedElement,
  elementLabel,
  elementTypeIcon,
  swatchPreview,
} = useCanvasEditorContext();

/** Whether the Fill section shows; the Appearance summary previews the fill only then. */
const hasFillSection = computed(() => {
  const el = selectedElement.value;
  return (
    !!el &&
    el.type !== "avatar" &&
    (el.type !== "image" || profile.value.images.isTintableSvg(el.src)) &&
    el.type !== "line"
  );
});
</script>
