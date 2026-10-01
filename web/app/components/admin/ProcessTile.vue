<template>
  <article class="glide-tile rounded-2xl p-5" :class="stale ? 'opacity-60' : ''">
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-sm font-semibold text-white">{{ title }}</h3>
        <p v-if="subtitle" class="mt-0.5 text-xs glide-ink-3">{{ subtitle }}</p>
      </div>
      <span
        v-if="stale"
        class="inline-flex shrink-0 items-center rounded-full border border-warning/40 bg-warning/10 px-2.5 py-0.5 text-[11px] text-warning"
      >
        No data for {{ formatAge(ageMs) }}
      </span>
      <span v-else class="glide-chip shrink-0 px-2.5 py-0.5 text-[11px]">Live</span>
    </header>

    <div class="mt-4 space-y-3">
      <AdminMeter
        label="CPU"
        :value="formatPercent(sample.cpuPercent)"
        :ratio="Math.min(sample.cpuPercent / 100, 1)"
      />
      <AdminMeter
        label="Heap"
        neutral
        :value="`${formatBytes(sample.heapUsedBytes)} / ${formatBytes(sample.heapTotalBytes)}`"
        :ratio="memoryRatio(sample.heapUsedBytes, sample.heapTotalBytes)"
      />
    </div>

    <dl class="mt-4 grid grid-cols-3 gap-3 text-xs">
      <div>
        <dt class="glide-ink-3">Memory (RSS)</dt>
        <dd class="mt-1 font-mono text-white">{{ formatBytes(sample.rssBytes) }}</dd>
      </div>
      <div>
        <dt class="glide-ink-3">Loop lag p99</dt>
        <dd class="mt-1 font-mono text-white">{{ sample.eventLoopLagMs.toFixed(1) }} ms</dd>
      </div>
      <div>
        <dt class="glide-ink-3">Uptime</dt>
        <dd class="mt-1 font-mono text-white">{{ formatUptime(sample.uptimeSeconds) }}</dd>
      </div>
    </dl>

    <div class="mt-4">
      <p class="mb-1 text-[11px] glide-ink-4">CPU, last 5 min</p>
      <AdminSparkline :values="cpuHistory" :max="100" />
    </div>
  </article>
</template>

<script setup lang="ts">
import type { ProcessMetrics } from '../../../server/utils/admin-resources/types'
import { formatAge, formatBytes, formatPercent, formatUptime, memoryRatio } from '~/utils/admin-resources'

withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    sample: ProcessMetrics
    cpuHistory: number[]
    stale?: boolean
    ageMs?: number
  }>(),
  { stale: false, ageMs: 0 },
)
</script>
