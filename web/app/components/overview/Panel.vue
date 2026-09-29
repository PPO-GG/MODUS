<template>
  <section class="overview-panel">
    <header class="flex items-center justify-between gap-3 mb-3">
      <h2 class="text-sm font-semibold text-white">{{ title }}</h2>
      <span v-if="$slots.meta" class="text-[11px] text-gray-500 font-mono truncate"><slot name="meta" /></span>
    </header>
    <div v-if="loading" class="space-y-2" aria-busy="true">
      <div v-for="i in 3" :key="i" class="h-8 rounded-lg bg-white/[0.04] animate-pulse" />
    </div>
    <div v-else-if="error" class="flex items-center justify-between gap-3 text-sm text-gray-400">
      <span>Couldn't load {{ title.toLowerCase() }}.</span>
      <UButton size="xs" color="neutral" variant="soft" icon="i-lucide-rotate-cw" @click="emit('retry')">Retry</UButton>
    </div>
    <p v-else-if="empty" class="text-sm text-gray-500">{{ emptyText }}</p>
    <slot v-else />
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string; loading?: boolean; error?: string | null; empty?: boolean; emptyText?: string }>();
const emit = defineEmits<{ retry: [] }>();
</script>

<style scoped>
.overview-panel {
  border-radius: 0.75rem;
  padding: 1rem 1.125rem;
  background: rgba(3, 7, 18, 0.55);
  box-shadow: inset 0 0 0 1px rgba(243, 244, 246, 0.1);
  min-width: 0;
}
@media (prefers-reduced-motion: reduce) {
  .animate-pulse {
    animation: none;
  }
}
</style>
