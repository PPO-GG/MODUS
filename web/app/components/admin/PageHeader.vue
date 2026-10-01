<template>
  <header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div class="flex min-w-0 items-start gap-3 sm:gap-4">
      <div
        v-if="icon"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
      >
        <UIcon :name="icon" class="h-5 w-5 text-sky-200" aria-hidden="true" />
      </div>
      <div class="min-w-0">
        <p v-if="eyebrow" class="text-xs font-semibold uppercase tracking-[0.18em] glide-a1">
          {{ eyebrow }}
        </p>
        <h1 class="text-xl font-semibold leading-tight text-white" :class="eyebrow ? 'mt-1' : ''">
          {{ title }}
        </h1>
        <p v-if="description || $slots.description" class="mt-1 text-sm text-gray-400">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2 self-start">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: string;
}>();
</script>
