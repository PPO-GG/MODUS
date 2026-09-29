<template>
  <img
    v-if="src && !failed"
    :src="src"
    :alt="alt"
    class="shrink-0 object-cover"
    @error="failed = true"
  />
  <div
    v-else
    class="flex shrink-0 items-center justify-center bg-white/[0.06] text-gray-500"
    role="img"
    :aria-label="alt"
  >
    <UIcon name="i-lucide-music" class="h-1/2 w-1/2" />
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ src?: string | null; alt: string }>();

// A dead thumbnail URL falls back to the icon; a new track gets a fresh try.
const failed = ref(false);
watch(
  () => props.src,
  () => (failed.value = false),
);
</script>
