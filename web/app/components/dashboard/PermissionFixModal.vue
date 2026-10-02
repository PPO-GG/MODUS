<template>
  <UModal :open="fix.open" :dismissible="!fix.applying" @update:open="onOpenChange">
    <template #content>
      <div class="max-h-[90vh] space-y-5 overflow-y-auto p-6">
        <header class="space-y-1">
          <h2 class="text-lg font-bold text-white">Fix this finding</h2>
          <p v-if="fix.finding" class="text-sm text-gray-400">{{ fix.finding.title }}</p>
        </header>

        <div v-if="fix.loading" class="space-y-2" aria-busy="true">
          <div class="h-10 animate-pulse rounded-lg bg-white/[0.04]" />
          <div class="h-24 animate-pulse rounded-lg bg-white/[0.04]" />
        </div>

        <template v-else-if="fix.preview?.plan">
          <p class="text-sm text-gray-200">{{ fix.preview.plan.summary }}</p>

          <section
            v-for="(change, index) in fix.preview.plan.changes"
            :key="index"
            class="space-y-3 rounded-xl bg-white/[0.04] p-4 ring-1 ring-inset ring-white/10"
          >
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">
              #{{ change.channelName }} · {{ opLabel[change.op] }}
            </p>
            <div class="grid gap-3 sm:grid-cols-2">
              <div v-for="side in sides(change)" :key="side.title">
                <p class="mb-1 text-xs font-semibold text-gray-400">{{ side.title }}</p>
                <p v-if="side.list.length === 0" class="text-xs italic text-gray-500">
                  {{ side.empty }}
                </p>
                <ul v-else class="space-y-2">
                  <li v-for="o in side.list" :key="`${o.type}:${o.id}`" class="text-xs">
                    <span class="font-semibold text-gray-200">{{ o.label }}</span>
                    <div v-if="o.allowNames.length" class="mt-1 flex flex-wrap gap-1">
                      <span
                        v-for="n in o.allowNames"
                        :key="`a-${n}`"
                        class="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[11px] text-emerald-200"
                        >+ {{ n }}</span
                      >
                    </div>
                    <div v-if="o.denyNames.length" class="mt-1 flex flex-wrap gap-1">
                      <span
                        v-for="n in o.denyNames"
                        :key="`d-${n}`"
                        class="rounded bg-red-400/15 px-1.5 py-0.5 text-[11px] text-red-200"
                        >− {{ n }}</span
                      >
                    </div>
                    <p v-if="!o.allowNames.length && !o.denyNames.length" class="mt-1 text-gray-500">
                      No named permissions
                    </p>
                  </li>
                </ul>
              </div>
            </div>
          </section>

        </template>

        <!-- Outside the plan block: the server returns plan: null plus a blocker for stale findings. -->
        <div v-if="!fix.loading && fix.preview?.blockers.length" role="alert">
          <ul class="space-y-1">
            <li
              v-for="b in fix.preview.blockers"
              :key="b"
              class="flex gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-200 ring-1 ring-inset ring-amber-500/20"
            >
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
              {{ b }}
            </li>
          </ul>
        </div>

        <div
          v-if="fix.error"
          class="flex gap-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-200 ring-1 ring-inset ring-red-500/20"
          role="alert"
        >
          <UIcon name="i-lucide-circle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
          {{ fix.error }}
        </div>

        <p class="text-[11px] text-gray-500">
          A record of the previous values is saved to the Server Logs when possible; Discord's own audit
          log also records this change.
        </p>

        <footer class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton color="neutral" variant="ghost" :disabled="fix.applying" @click="emit('close')">
            Cancel
          </UButton>
          <UButton
            color="primary"
            :loading="fix.applying"
            :disabled="!fix.preview?.canApply || fix.applying || fix.loading"
            @click="emit('confirm')"
          >
            Apply fix
          </UButton>
        </footer>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import type { FixChange, OverwriteState } from "#shared/permission-audit-types";
import type { FixState } from "~/composables/usePermissionAudit";

const props = defineProps<{ fix: FixState }>();
const emit = defineEmits<{ confirm: []; close: [] }>();

// Escape / outside click arrive here as open=false. While a fix is being applied the modal must stay
// open: closing or switching mid-request would discard the in-flight state.
const onOpenChange = (open: boolean) => {
  if (!open && !props.fix.applying) emit("close");
};

const opLabel: Record<FixChange["op"], string> = {
  "set-overwrite": "Change an overwrite",
  "delete-overwrite": "Remove an overwrite",
  "replace-overwrites": "Replace all overwrites",
};

const sides = (change: FixChange): Array<{ title: string; list: OverwriteState[]; empty: string }> => [
  { title: "Before", list: change.before, empty: "No overwrite" },
  { title: "After", list: change.after, empty: "Overwrite removed" },
];
</script>
