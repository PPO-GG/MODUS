<template>
  <header class="flex items-start gap-3 sm:gap-4">
    <NuxtLink
      :to="`/dashboard/server/${guildId}/modules`"
      class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/5 hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300"
      aria-label="Back to modules"
    >
      <UIcon name="i-lucide-arrow-left" class="h-4 w-4" />
    </NuxtLink>
    <div
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
    >
      <UIcon :name="icon" class="h-5 w-5 text-sky-200" />
    </div>
    <div class="min-w-0 flex-1">
      <h2 class="text-lg font-semibold text-white leading-tight">{{ title }}</h2>
      <p class="mt-0.5 text-sm text-gray-400">{{ description }}</p>
    </div>
    <!-- Pages can replace the status pill (the AI page shows its enable switch here). -->
    <slot name="status">
      <span
        class="hidden shrink-0 items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] sm:inline-flex"
        :class="
          enabled
            ? 'border-emerald-400/30 bg-emerald-400/5 text-emerald-300'
            : 'border-white/10 bg-white/[0.03] text-gray-400'
        "
      >
        <span
          class="h-1.5 w-1.5 rounded-full"
          :class="enabled ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-gray-500'"
        />
        {{ enabled ? "ACTIVE" : "DISABLED" }}
      </span>
    </slot>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  guildId: string;
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
}>();
</script>
