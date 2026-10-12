<template>
  <div
    class="rounded-lg ring-1 ring-inset transition-colors"
    :class="[
      row.pendingSource ? 'bg-sky-200/[0.06] ring-sky-100/20' : 'bg-white/[0.02] ring-white/5',
      depth === 1 ? 'ml-7' : '',
    ]"
  >
    <div class="flex items-start gap-3 p-3">
      <UCheckbox
        :model-value="selected"
        :disabled="row.channel.kind === null"
        :aria-label="`Select ${row.channel.name}`"
        class="mt-0.5"
        @update:model-value="emit('toggle-select')"
      />
      <button
        type="button"
        class="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-teal-300"
        :disabled="row.channel.kind === null"
        :aria-expanded="expanded"
        @click="emit('toggle-expand')"
      >
        <div class="flex items-center gap-2">
          <UIcon :name="icon" class="h-4 w-4 shrink-0 text-gray-400" />
          <span class="truncate text-sm font-semibold text-white">{{ row.channel.name }}</span>
          <span v-if="row.pendingSource === 'own'" class="rounded-full bg-sky-200/15 px-2 py-0.5 text-[11px] text-sky-100">Pending</span>
          <span v-else-if="row.pendingSource === 'category'" class="rounded-full bg-sky-200/10 px-2 py-0.5 text-[11px] text-sky-200">
            Inherits pending change
          </span>
          <span v-if="row.cascadeCount > 0" class="text-[11px] text-gray-400">
            will also update {{ row.cascadeCount }} synced channel{{ row.cascadeCount === 1 ? "" : "s" }}
          </span>
        </div>
        <div class="mt-1.5 flex flex-wrap items-center gap-2">
          <DashboardChannelAccessBadges
            :rule="row.channel.rule"
            :see-summary="row.channel.seeSummary"
            :post-summary="row.channel.postSummary"
            :roles="roles"
            :member-overrides="row.channel.memberOverrides"
            :synced="row.channel.syncedWithParent"
            :supported="row.channel.kind !== null"
          />
          <template v-if="row.pending">
            <UIcon name="i-lucide-arrow-right" class="h-3.5 w-3.5 text-sky-200" aria-label="becomes" />
            <DashboardChannelAccessBadges :rule="row.pending" see-summary="" post-summary="" :roles="roles" compact />
          </template>
        </div>
      </button>
      <UButton
        v-if="row.pendingSource === 'own'"
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-undo-2"
        aria-label="Discard this edit"
        @click="emit('clear-edit')"
      />
    </div>
    <div v-if="expanded" class="border-t border-white/5 p-3">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AccessRoleOption } from "#shared/channel-access";
import type { AccessRow } from "~/composables/useChannelAccess";

const props = withDefaults(
  defineProps<{
    row: AccessRow;
    roles: Record<string, AccessRoleOption>;
    selected: boolean;
    expanded: boolean;
    depth?: 0 | 1;
  }>(),
  { depth: 0 },
);
const emit = defineEmits<{ "toggle-select": []; "toggle-expand": []; "clear-edit": [] }>();

const icon = computed(() => {
  const t = props.row.channel.type;
  if (t === 4) return "i-lucide-folder";
  if (t === 2) return "i-lucide-volume-2";
  if (t === 13) return "i-lucide-radio";
  if (t === 15 || t === 16) return "i-lucide-messages-square";
  if (t === 5) return "i-lucide-megaphone";
  return "i-lucide-hash";
});
</script>
