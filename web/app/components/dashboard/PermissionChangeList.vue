<template>
  <div class="space-y-3">
    <template v-if="grouped">
      <details
        v-for="group in groups"
        :key="group.channelId"
        class="group rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/10"
        :open="groups.length <= 3"
      >
        <summary class="flex cursor-pointer list-none items-center gap-2 p-4 text-sm text-gray-100">
          <UIcon name="i-lucide-hash" class="h-4 w-4 shrink-0 text-sky-200" />
          <span class="min-w-0 flex-1 truncate font-semibold">{{ group.channelName }}</span>
          <span class="text-xs text-gray-400">{{ group.changes.length }} change{{ group.changes.length === 1 ? "" : "s" }}</span>
          <UIcon
            name="i-lucide-chevron-down"
            class="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
          />
        </summary>
        <div class="space-y-3 border-t border-white/5 p-4">
          <section v-for="(change, index) in group.changes" :key="index" class="space-y-3">
            <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {{ targetLabel(change) }} · {{ opLabel[change.op] }}
            </p>
            <div class="grid gap-3 sm:grid-cols-2">
              <div v-for="side in sides(change)" :key="side.title">
                <p class="mb-1 text-xs font-semibold text-gray-400">{{ side.title }}</p>
                <p v-if="side.list.length === 0" class="text-xs italic text-gray-500">{{ side.empty }}</p>
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
        </div>
      </details>
    </template>

    <template v-else>
      <section
        v-for="(change, index) in changes"
        :key="index"
        class="space-y-3 rounded-xl bg-white/[0.04] p-4 ring-1 ring-inset ring-white/10"
      >
        <p class="text-xs font-semibold uppercase tracking-wider text-gray-500">
          #{{ change.channelName }} · {{ opLabel[change.op] }}
        </p>
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="side in sides(change)" :key="side.title">
            <p class="mb-1 text-xs font-semibold text-gray-400">{{ side.title }}</p>
            <p v-if="side.list.length === 0" class="text-xs italic text-gray-500">{{ side.empty }}</p>
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
  </div>
</template>

<script setup lang="ts">
import type { FixChange, OverwriteState } from "#shared/permission-audit-types";

const props = defineProps<{
  changes: FixChange[];
  /** Group changes by channel into collapsible blocks (presets); otherwise one block per change. */
  grouped?: boolean;
}>();

const opLabel: Record<FixChange["op"], string> = {
  "set-overwrite": "Change an overwrite",
  "delete-overwrite": "Remove an overwrite",
  "replace-overwrites": "Replace all overwrites",
};

const sides = (change: FixChange): Array<{ title: string; list: OverwriteState[]; empty: string }> => [
  { title: "Before", list: change.before, empty: "No overwrite" },
  { title: "After", list: change.after, empty: "Overwrite removed" },
];

const targetLabel = (change: FixChange) =>
  change.after[0]?.label ?? change.before[0]?.label ?? "Overwrites";

const groups = computed(() => {
  const byChannel = new Map<string, { channelId: string; channelName: string; changes: FixChange[] }>();
  for (const change of props.changes) {
    const group = byChannel.get(change.channelId);
    if (group) group.changes.push(change);
    else byChannel.set(change.channelId, { channelId: change.channelId, channelName: change.channelName, changes: [change] });
  }
  return [...byChannel.values()];
});
</script>
