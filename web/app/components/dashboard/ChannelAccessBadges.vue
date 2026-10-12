<template>
  <div class="flex flex-wrap items-center gap-1.5" :class="compact ? 'text-[11px]' : 'text-xs'">
    <!-- Who can see -->
    <template v-if="!supported">
      <span class="rounded-full bg-white/[0.06] px-2 py-0.5 text-gray-400">Not supported</span>
    </template>
    <template v-else-if="rule === null">
      <span class="rounded-full bg-amber-400/15 px-2 py-0.5 text-amber-200" :title="`${seeSummary} · ${postSummary}`">Custom</span>
      <span class="text-gray-400">{{ seeSummary }}</span>
    </template>
    <template v-else-if="rule.see.kind === 'everyone'">
      <span class="rounded-full bg-sky-200/10 px-2 py-0.5 text-sky-100">
        <UIcon name="i-lucide-eye" class="mr-1 inline h-3 w-3 align-[-1px]" />Everyone
      </span>
    </template>
    <template v-else>
      <span v-if="visibleRoles.length === 0" class="rounded-full bg-white/[0.06] px-2 py-0.5 text-gray-300" :title="adminHint">
        <UIcon name="i-lucide-eye-off" class="mr-1 inline h-3 w-3 align-[-1px]" />Nobody
      </span>
      <template v-else>
        <span
          v-for="id in visibleRoles.slice(0, 3)"
          :key="id"
          class="rounded-full bg-violet-300/15 px-2 py-0.5 text-violet-100"
          :title="adminHint"
        >
          {{ roles[id]?.name ?? `role ${id}` }}
        </span>
        <span v-if="visibleRoles.length > 3" class="text-gray-400" :title="overflowNames">+{{ visibleRoles.length - 3 }}</span>
      </template>
    </template>

    <!-- Who can post -->
    <template v-if="supported && rule">
      <span v-if="rule.post.kind === 'nobody'" class="rounded-full bg-white/[0.06] px-2 py-0.5 text-gray-200">
        <UIcon name="i-lucide-lock" class="mr-1 inline h-3 w-3 align-[-1px]" />read-only
      </span>
      <span v-else-if="rule.post.kind === 'roles'" class="rounded-full bg-emerald-400/15 px-2 py-0.5 text-emerald-100" :title="postSummary">
        posting: {{ names(rule.post.roleIds) }}
      </span>
    </template>

    <!-- Context -->
    <span v-if="synced === true" class="text-gray-500">Synced</span>
    <span v-else-if="synced === false" class="text-gray-500">Own permissions</span>
    <span v-if="memberOverrides" class="text-gray-500">{{ memberOverrides }} member override{{ memberOverrides === 1 ? "" : "s" }}</span>
  </div>
</template>

<script setup lang="ts">
import type { AccessRoleOption, AccessRule } from "#shared/channel-access";

const props = withDefaults(
  defineProps<{
    rule: AccessRule | null;
    seeSummary: string;
    postSummary: string;
    roles: Record<string, AccessRoleOption>;
    memberOverrides?: number;
    synced?: boolean | null;
    supported?: boolean;
    compact?: boolean;
  }>(),
  { memberOverrides: 0, synced: null, supported: true, compact: false },
);

// Roles with Administrator always see everything; they're a hint, not a chip.
const adminRoles = computed(() => Object.values(props.roles).filter((r) => r.admin));
const adminHint = computed(() =>
  adminRoles.value.length ? `Roles with Administrator always see this channel: ${adminRoles.value.map((r) => r.name).join(", ")}` : undefined,
);
const visibleRoles = computed(() =>
  props.rule?.see.kind === "roles" ? props.rule.see.roleIds.filter((id) => !props.roles[id]?.admin) : [],
);
const names = (ids: string[]) => ids.map((id) => props.roles[id]?.name ?? `role ${id}`).join(", ");
const overflowNames = computed(() => names(visibleRoles.value.slice(3)));
</script>
