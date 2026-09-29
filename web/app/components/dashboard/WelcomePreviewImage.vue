<template>
  <div
    class="relative overflow-hidden rounded-md bg-black/20"
    :class="{ 'aspect-[1024/500]': !loaded }"
  >
    <img
      v-if="!failed"
      :src="src"
      alt="Welcome image preview"
      class="block h-auto w-full"
      :class="{ 'absolute inset-0 opacity-0': !loaded }"
      @load="loaded = true"
      @error="failed = true"
    />
    <div
      v-if="!loaded"
      class="absolute inset-0 flex items-center justify-center text-xs text-gray-400"
    >
      <span v-if="failed">Couldn't render the preview image.</span>
      <UIcon v-else name="i-lucide-loader-circle" class="h-5 w-5 animate-spin" />
    </div>
    <div class="absolute bottom-2 right-2">
      <UButton
        icon="i-lucide-pencil"
        label="Edit image"
        color="neutral"
        variant="solid"
        size="sm"
        class="shadow-lg"
        @click="emit('edit')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  /** Rendered welcome image URL. */
  src: string;
}>();
const emit = defineEmits<{ edit: [] }>();

const loaded = ref(false);
const failed = ref(false);

// A new URL (after the design is saved) loads afresh.
watch(
  () => props.src,
  () => {
    loaded.value = false;
    failed.value = false;
  },
);
</script>
