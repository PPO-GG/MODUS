<template>
  <div
    class="relative rounded-md overflow-hidden bg-black/20"
    :class="{ 'aspect-[1024/500]': !loaded }"
  >
    <img
      v-if="!failed"
      :src="src"
      alt="Welcome image preview"
      class="block w-full h-auto"
      :class="{ 'absolute inset-0 opacity-0': !loaded }"
      @load="loaded = true"
      @error="failed = true"
    />
    <div
      v-if="!loaded"
      class="absolute inset-0 flex items-center justify-center text-xs text-gray-500"
    >
      <span v-if="failed">Couldn't render the preview image.</span>
      <UIcon v-else name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
    </div>
    <div class="absolute bottom-2 right-2">
      <UButton
        :to="editTo"
        icon="i-heroicons-pencil-square"
        label="Edit image"
        color="neutral"
        variant="solid"
        size="sm"
        class="shadow-lg"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineProps<{
  /** Rendered welcome image URL. */
  src: string;
  /** Route to the welcome image editor. */
  editTo: string;
}>();

const loaded = ref(false);
const failed = ref(false);
</script>
