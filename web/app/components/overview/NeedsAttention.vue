<template>
  <section v-if="issues.length" class="rounded-xl p-4 bg-amber-400/[0.06] ring-1 ring-inset ring-amber-400/25" aria-label="Needs attention">
    <h2 class="flex items-center gap-2 text-sm font-semibold text-amber-300 mb-2">
      <UIcon name="i-lucide-triangle-alert" class="w-4 h-4" /> Needs attention · {{ issues.length }}
    </h2>
    <ul class="divide-y divide-amber-400/10">
      <li v-for="issue in issues" :key="issue.module + issue.message" class="flex items-center gap-3 py-2 text-sm text-gray-200">
        <span class="min-w-0">{{ issue.message }}</span>
        <NuxtLink :to="issue.fixTo" class="ml-auto shrink-0 text-sky-200 hover:text-primary-300 text-[13px]">Fix →</NuxtLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { SetupIssue } from "~/utils/module-setup-checks";
defineProps<{ issues: SetupIssue[] }>();
</script>
