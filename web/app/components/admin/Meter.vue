<template>
  <div>
    <div class="flex items-baseline justify-between gap-2 text-xs">
      <span class="glide-ink-3">{{ label }}</span>
      <span class="font-mono text-white">{{ value }}</span>
    </div>
    <div
      class="glide-bar-track mt-1.5 h-1.5"
      role="meter"
      :aria-label="label"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent"
    >
      <div class="glide-bar-fill meter-fill" :class="`tone-${tone}`" :style="{ width: `${percent}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { meterTone } from '~/utils/admin-resources'

const props = defineProps<{
  label: string
  value: string
  /** 0..1 */
  ratio: number
  /** Skip the warn/hot colouring for ratios that aren't a headroom measure (e.g. V8 heap used/total). */
  neutral?: boolean
}>()

const percent = computed(() => Math.round(Math.min(Math.max(props.ratio, 0), 1) * 100))
const tone = computed(() => (props.neutral ? 'ok' : meterTone(props.ratio)))
</script>

<style scoped>
.meter-fill {
  transition: width 0.5s ease;
}
.tone-warn {
  background: #fbbf24;
}
.tone-hot {
  background: #f87171;
}
@media (prefers-reduced-motion: reduce) {
  .meter-fill {
    transition: none;
  }
}
</style>
