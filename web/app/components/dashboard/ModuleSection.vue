<template>
  <section class="module-section">
    <header class="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div class="min-w-0 flex-1 basis-56">
        <h3 class="text-sm font-semibold text-white">{{ title }}</h3>
        <p v-if="description" class="mt-0.5 text-[13px] text-gray-400">{{ description }}</p>
      </div>
      <div v-if="$slots.actions" class="shrink-0">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string; description?: string }>();
</script>

<style scoped>
.module-section {
  border-radius: 0.75rem;
  padding: 1.25rem;
  background: rgba(3, 7, 18, 0.55);
  box-shadow: inset 0 0 0 1px rgba(243, 244, 246, 0.1);
  min-width: 0;
}
</style>
