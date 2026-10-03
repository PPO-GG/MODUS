<template>
  <UModal :open="state.open" :dismissible="!state.applying" @update:open="onOpenChange">
    <template #content>
      <div class="max-h-[90vh] space-y-5 overflow-y-auto p-6">
        <header class="space-y-1">
          <h2 class="text-lg font-bold text-white">Apply "{{ presetLabel }}"</h2>
          <p class="text-sm text-gray-400">Review exactly what will change before anything is written.</p>
        </header>

        <div v-if="state.loading" class="space-y-2" aria-busy="true">
          <div class="h-10 animate-pulse rounded-lg bg-white/[0.04]" />
          <div class="h-24 animate-pulse rounded-lg bg-white/[0.04]" />
        </div>

        <template v-else-if="state.preview?.plan">
          <p class="text-sm text-gray-200">{{ state.preview.plan.summary }}</p>
          <ul v-if="state.preview.stats" class="flex flex-wrap gap-2 text-xs">
            <li class="rounded-full bg-white/[0.06] px-3 py-1 text-gray-200">
              {{ state.preview.stats.channels }} channel{{ state.preview.stats.channels === 1 ? "" : "s" }}
            </li>
            <li class="rounded-full bg-emerald-400/15 px-3 py-1 text-emerald-200">
              {{ state.preview.stats.changed }} will change
            </li>
            <li class="rounded-full bg-white/[0.06] px-3 py-1 text-gray-300">
              {{ state.preview.stats.unchanged }} already match
            </li>
            <li class="rounded-full bg-white/[0.06] px-3 py-1 text-gray-300">
              {{ state.preview.stats.changes }} overwrite change{{ state.preview.stats.changes === 1 ? "" : "s" }}
            </li>
          </ul>
          <p v-if="hasCategory" class="text-xs text-gray-400">
            Categories only change their own permissions. Channels inside a category are not changed; select
            them too to change them.
          </p>
          <DashboardPermissionChangeList :changes="state.preview.plan.changes" grouped />
        </template>

        <!-- Outside the plan block: a null plan comes with blockers that explain why. -->
        <div v-if="!state.loading && state.preview?.blockers.length" role="alert">
          <ul class="space-y-1">
            <li
              v-for="b in state.preview.blockers"
              :key="b"
              class="flex gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200 ring-1 ring-inset ring-amber-500/20"
            >
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
              {{ b }}
            </li>
          </ul>
        </div>

        <div
          v-if="state.error"
          class="flex gap-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-200 ring-1 ring-inset ring-red-500/20"
          role="alert"
        >
          <UIcon name="i-lucide-circle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
          {{ state.error }}
        </div>

        <p class="text-[11px] text-gray-500">
          A record of the previous values is saved to the Server Logs when possible; Discord's own audit
          log also records these changes. If a change fails partway, the earlier ones stay applied and the
          message says how many.
        </p>

        <footer class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton color="neutral" variant="ghost" :disabled="state.applying" @click="emit('close')">
            Cancel
          </UButton>
          <UButton
            color="primary"
            :loading="state.applying"
            :disabled="!state.preview?.canApply || state.applying || state.loading"
            @click="emit('confirm')"
          >
            Apply preset
          </UButton>
        </footer>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { PresetPreviewState } from "~/composables/usePermissionPresets";

const props = defineProps<{
  state: PresetPreviewState;
  presetLabel: string;
  hasCategory: boolean;
}>();
const emit = defineEmits<{ confirm: []; close: [] }>();

// Escape / outside click arrive here as open=false. While a preset is being applied the modal must
// stay open: closing it mid-request would discard the in-flight state.
const onOpenChange = (open: boolean) => {
  if (!open && !props.state.applying) emit("close");
};
</script>
