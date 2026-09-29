<template>
  <!--
    Zero-cost anchor: a fixed-height sticky slot that is always in the flow, so
    the bar appearing/disappearing never changes the page height (and so never
    adds or removes a scrollbar). The bar is positioned inside it.
  -->
  <div class="pointer-events-none sticky bottom-6 z-20 h-14">
    <Transition name="save-bar">
      <div
        v-if="visible"
        class="pointer-events-auto absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 rounded-full border py-2 pl-5 pr-2 backdrop-blur-xl transition-[border-color,box-shadow,background-color] duration-300"
        :class="
          justSaved
            ? 'border-emerald-400/50 bg-[rgba(4,20,16,0.9)] shadow-[0_0_20px_rgba(52,211,153,0.35)]'
            : 'border-amber-400/40 bg-[rgba(3,7,18,0.88)] shadow-[0_0_20px_rgba(251,191,36,0.25)]'
        "
        role="status"
      >
        <span
          v-if="justSaved"
          class="flex items-center gap-2 whitespace-nowrap py-1 text-sm font-medium text-emerald-300"
        >
          <UIcon name="i-lucide-circle-check" class="h-4 w-4 shrink-0" />
          Saved
        </span>
        <template v-else>
          <span class="flex items-center gap-2 whitespace-nowrap text-sm text-amber-200">
            <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
            <span class="sm:hidden">Unsaved</span>
            <span class="hidden sm:inline">Unsaved changes</span>
          </span>
          <div class="flex items-center gap-2 whitespace-nowrap">
            <UButton size="sm" color="neutral" variant="ghost" :disabled="saving" @click="emit('discard')">
              Discard
            </UButton>
            <UButton size="sm" color="primary" icon="i-lucide-check" :loading="saving" @click="emit('save')">
              <span>Save<span class="hidden sm:inline"> changes</span></span>
            </UButton>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ dirty: boolean; saving?: boolean }>();
const emit = defineEmits<{ save: []; discard: [] }>();

const SAVED_FLASH_MS = 1000;

const visible = ref(props.dirty);
const justSaved = ref(false);
// True once a save started during this dirty cycle, so dirty→false can be told
// apart: after a save it flashes green, after Discard it just hides.
let saveStarted = false;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.saving,
  (saving) => {
    if (saving) saveStarted = true;
  },
);

watch(
  () => props.dirty,
  (dirty) => {
    clearTimeout(hideTimer);
    if (dirty) {
      visible.value = true;
      justSaved.value = false;
      saveStarted = false;
      return;
    }
    if (!saveStarted) {
      visible.value = false;
      return;
    }
    saveStarted = false;
    justSaved.value = true;
    hideTimer = setTimeout(() => {
      visible.value = false;
      justSaved.value = false;
    }, SAVED_FLASH_MS);
  },
);

onBeforeUnmount(() => clearTimeout(hideTimer));
</script>

<style scoped>
.save-bar-enter-active,
.save-bar-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.save-bar-enter-from,
.save-bar-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
@media (prefers-reduced-motion: reduce) {
  .save-bar-enter-active,
  .save-bar-leave-active {
    transition: none;
  }
}
</style>
