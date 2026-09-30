<template>
  <article class="module-card" :class="{ 'is-enabled': enabled }">
    <div class="flex items-start justify-between">
      <div
        class="module-card-icon w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        :class="display.bgClass"
      >
        <UIcon :name="display.icon" class="w-5 h-5" :class="display.iconClass" />
      </div>
      <USwitch
        :model-value="enabled"
        :loading="updating"
        :aria-label="`${enabled ? 'Disable' : 'Enable'} ${display.displayName}`"
        @update:model-value="(v: boolean) => emit('toggle', v)"
      />
    </div>

    <div class="flex items-center gap-2">
      <h3 class="text-base font-medium text-white">{{ display.displayName }}</h3>
      <span
        class="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        :class="enabled ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-gray-600'"
      />
    </div>

    <p class="text-[13px] text-gray-300 leading-relaxed line-clamp-2">
      {{ description }}
    </p>

    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="tag in display.tags.slice(0, 3)"
        :key="tag"
        type="button"
        class="font-mono text-[11px] px-2 py-0.5 rounded-full bg-white/[0.04] text-gray-400 hover:bg-white/[0.1] hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-teal-300 focus-visible:outline-offset-1"
        @click="emit('tag', tag)"
      >
        #{{ tag }}
      </button>
    </div>

    <div class="mt-auto pt-3 border-t border-white/[0.06]">
      <NuxtLink
        v-if="configureTo"
        :to="configureTo"
        class="inline-flex items-center gap-1.5 text-[13px] text-sky-200 hover:text-primary-300 transition-colors"
      >
        <UIcon name="i-lucide-settings-2" class="w-3.5 h-3.5" />
        Configure
      </NuxtLink>
      <span v-else class="text-[12px] text-gray-500 italic">No extra configuration required</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { ModuleDisplay } from "~/utils/module-metadata";

defineProps<{
  display: ModuleDisplay;
  description?: string | null;
  enabled: boolean;
  updating?: boolean;
  configureTo?: string | null;
}>();
const emit = defineEmits<{ toggle: [value: boolean]; tag: [tag: string] }>();
</script>

<style scoped>
/* Glass bento ring on every card; enabled → teal hairline; off → dimmed. */
.module-card {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background: rgba(3, 7, 18, 0.6);
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.module-card::before {
  content: "";
  position: absolute;
  inset: -7px;
  z-index: -1;
  border-radius: 13px;
  border: 1px solid rgba(243, 244, 246, 0.16);
  background: rgba(229, 231, 235, 0.06);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}
/* Enabled reads as a quiet teal hairline; the dimmed state below carries the contrast. */
.module-card.is-enabled::before {
  border-color: rgba(45, 212, 191, 0.3);
  background: rgba(45, 212, 191, 0.025);
}
.module-card:not(.is-enabled) {
  opacity: 0.62;
}
.module-card:not(.is-enabled) .module-card-icon {
  filter: grayscale(0.7);
}
.module-card:hover,
.module-card:focus-within {
  transform: translateY(-2px);
}
.module-card:not(.is-enabled):hover,
.module-card:not(.is-enabled):focus-within {
  opacity: 0.85;
}
@media (prefers-reduced-motion: reduce) {
  .module-card,
  .module-card::before {
    transition: none;
  }
  .module-card:hover,
  .module-card:focus-within {
    transform: none;
  }
}
</style>
