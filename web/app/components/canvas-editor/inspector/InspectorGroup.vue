<template>
  <div class="ce-group">
    <button
      type="button"
      class="ce-group-header"
      :aria-expanded="open"
      :aria-controls="bodyId"
      @click="toggle"
    >
      <UIcon
        :name="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        class="text-sm shrink-0"
      />
      <span class="ce-group-title">{{ title }}</span>
      <span v-if="!open && $slots.summary" class="ce-group-summary">
        <slot name="summary" />
      </span>
    </button>
    <div v-show="open" :id="bodyId">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useId } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    /** Remembers this group's open/closed state per viewer. */
    storageKey: string;
    defaultOpen?: boolean;
  }>(),
  { defaultOpen: true },
);

const STORAGE_PREFIX = "ce-inspector-group:";

/** The stored state, or null when nothing is stored or storage is unavailable. */
function readStored(): boolean | null {
  try {
    const value = localStorage.getItem(STORAGE_PREFIX + props.storageKey);
    if (value === "1") return true;
    if (value === "0") return false;
  } catch {
    /* storage blocked: fall back to the default */
  }
  return null;
}

const open = ref(readStored() ?? props.defaultOpen);
const bodyId = useId();

function toggle() {
  open.value = !open.value;
  try {
    localStorage.setItem(STORAGE_PREFIX + props.storageKey, open.value ? "1" : "0");
  } catch {
    /* storage blocked: the state lasts until the group unmounts */
  }
}
</script>
