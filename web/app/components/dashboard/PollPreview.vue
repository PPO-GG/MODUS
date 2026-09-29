<template>
  <div class="rounded-xl bg-[#313338] p-4">
    <div class="max-w-md rounded-lg bg-[#2b2d31] p-3">
      <p class="text-base font-semibold text-white">
        {{ question.trim() || "Your question" }}
      </p>
      <p class="mb-2 mt-0.5 text-xs text-[#949ba4]">
        {{ multiselect ? "Select one or more answers" : "Select one answer" }}
      </p>
      <ul class="space-y-1.5">
        <li
          v-for="(option, i) in shownOptions"
          :key="i"
          class="flex items-center gap-2.5 rounded-md bg-[#383a40] px-3 py-2 text-sm text-[#dbdee1]"
        >
          <span
            class="inline-block h-4 w-4 shrink-0 border-2 border-[#80848e]"
            :class="multiselect ? 'rounded' : 'rounded-full'"
            aria-hidden="true"
          />
          <span class="min-w-0 truncate">{{ option.trim() || `Answer ${i + 1}` }}</span>
        </li>
      </ul>
      <p class="mt-2 text-xs text-[#949ba4]">
        0 votes · ends in {{ durationLabel }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  question: string;
  options: string[];
  durationHours: number;
  multiselect: boolean;
}>();

// Blank trailing answers still show as placeholders, so the preview keeps its
// shape while the form is being filled in.
const shownOptions = computed(() => (props.options.length > 0 ? props.options : ["", ""]));

const durationLabel = computed(() => {
  const h = props.durationHours;
  if (!h || h < 1) return "—";
  if (h < 24) return `${h} hour${h !== 1 ? "s" : ""}`;
  const days = Math.floor(h / 24);
  const rest = h % 24;
  return `${days} day${days !== 1 ? "s" : ""}${rest ? ` ${rest}h` : ""}`;
});
</script>
