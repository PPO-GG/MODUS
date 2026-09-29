<template>
  <div class="ce-prop-section">
    <p class="ce-prop-title">Text</p>
    <textarea
      ref="textFieldRef"
      v-model="selectedElement.text"
      rows="2"
      aria-label="Text"
      class="ce-textarea"
      :placeholder="profile.textHint"
    />
    <!-- Variables: the textarea keeps its caret while the menu is open, and
         insertPlaceholder refocuses it after inserting. Non-modal so the menu
         doesn't trap that focus; focus then counts as having left the menu,
         so closing doesn't pull it back to the trigger (Escape still does). -->
    <UDropdownMenu
      :items="variableItems"
      :modal="false"
      size="sm"
      :content="{ align: 'start' }"
      :ui="{
        content: 'max-w-72',
        itemLabel: 'font-mono text-sky-200',
      }"
    >
      <UButton
        color="neutral"
        variant="outline"
        size="xs"
        icon="i-lucide-braces"
        trailing-icon="i-lucide-chevron-down"
        label="Insert variable"
        class="mt-2"
      />
    </UDropdownMenu>

    <!-- Font Family -->
    <div class="mt-2">
      <span class="ce-prop-label block mb-1">Font</span>
      <FontPicker
        :model-value="selectedElement.fontFamily || 'sans-serif'"
        @update:model-value="handleFontChange"
      />
    </div>

    <div class="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1.5">
      <div class="ce-prop-row">
        <span class="ce-prop-label">Size</span>
        <input
          aria-label="Font size"
          v-model.number="selectedElement.fontSize"
          type="number"
          class="ce-num-input w-full"
          min="6"
        />
      </div>
      <div class="ce-prop-row">
        <span class="ce-prop-label">Style</span>
        <select
          aria-label="Font style"
          v-model="selectedElement.fontStyle"
          class="ce-select w-full"
        >
          <option value="">Normal</option>
          <option value="bold">Bold</option>
          <option value="italic">Italic</option>
          <option value="bold italic">B+I</option>
        </select>
      </div>
    </div>

    <!-- Justification Buttons -->
    <div class="flex gap-1 mt-1.5">
      <button
        v-for="a in ['left', 'center', 'right']"
        :key="a"
        class="ce-tool-btn flex-1"
        :aria-pressed="selectedElement.align === a"
        :aria-label="`Align text ${a}`"
        @click="selectedElement!.align = a"
      >
        <UIcon
          :name="
            a === 'left'
              ? 'i-lucide-text-align-start'
              : a === 'center'
                ? 'i-lucide-text-align-center'
                : 'i-lucide-text-align-end'
          "
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { DropdownMenuItem } from "@nuxt/ui";
import { useCanvasEditorContext } from "~/composables/canvas-editor/useCanvasEditorContext";

const {
  profile,
  selectedElement,
  textFieldRef,
  insertPlaceholder,
  handleFontChange,
  previewText,
} = useCanvasEditorContext();

/** One item per profile token, with the sample value the canvas shows for it. */
const variableItems = computed<DropdownMenuItem[]>(() =>
  profile.value.placeholders.map((token) => {
    const sample = previewText(token);
    return {
      label: token,
      description: sample !== token ? `e.g. ${sample}` : undefined,
      onSelect: () => insertPlaceholder(token),
    };
  }),
);
</script>
