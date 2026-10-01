<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    class="block w-full overflow-visible"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <polyline
      v-if="points"
      :points="points"
      fill="none"
      stroke="var(--glide-a1)"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { sparklinePoints } from '~/utils/admin-resources'

const props = withDefaults(
  defineProps<{ values: number[]; max?: number; width?: number; height?: number }>(),
  { width: 120, height: 32 },
)

const points = computed(() => sparklinePoints(props.values, props.width, props.height, props.max))
</script>
