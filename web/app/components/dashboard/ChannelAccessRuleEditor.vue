<template>
  <div class="grid gap-3 sm:grid-cols-2">
    <div class="space-y-1.5">
      <label class="text-xs font-semibold text-gray-300">Who can see</label>
      <USelectMenu
        :model-value="model.see.kind"
        :items="SEE_KINDS"
        value-key="value"
        class="w-full"
        aria-label="Who can see"
        @update:model-value="(v: string) => setSeeKind(v as 'everyone' | 'roles')"
      />
      <USelectMenu
        v-if="model.see.kind === 'roles'"
        :model-value="model.see.roleIds"
        :items="roleItems"
        value-key="value"
        multiple
        placeholder="Choose roles…"
        class="w-full"
        aria-label="Roles that can see"
        @update:model-value="(v: string[]) => setSeeRoles(v)"
      />
    </div>

    <div class="space-y-1.5">
      <label class="text-xs font-semibold text-gray-300">Who can post / speak</label>
      <USelectMenu
        :model-value="model.post.kind"
        :items="POST_KINDS"
        value-key="value"
        class="w-full"
        aria-label="Who can post"
        @update:model-value="(v: string) => setPostKind(v as 'everyone' | 'roles' | 'nobody')"
      />
      <USelectMenu
        v-if="model.post.kind === 'roles'"
        :model-value="model.post.roleIds"
        :items="posterItems"
        value-key="value"
        multiple
        placeholder="Choose roles…"
        class="w-full"
        aria-label="Roles that can post"
        @update:model-value="(v: string[]) => setPostRoles(v)"
      />
    </div>

    <p v-if="isCustom" class="sm:col-span-2 flex gap-2 text-xs text-amber-200">
      <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
      This channel has custom overwrites. Saving replaces its view and post settings for roles; everything else is kept.
    </p>
    <p v-if="botWontSee" class="sm:col-span-2 flex gap-2 text-xs text-amber-200">
      <UIcon name="i-lucide-bot" class="mt-0.5 h-4 w-4 shrink-0" />
      The bot won't see this channel. Include the bot's role if a module (logging, tickets…) uses it; the review blocks changes that would cut a module off.
    </p>
  </div>
</template>

<script setup lang="ts">
import type { AccessRoleOption, AccessRule } from "#shared/channel-access";

const props = defineProps<{
  roles: AccessRoleOption[];
  botTopPosition: number | null;
  botWontSee: boolean;
  isCustom: boolean;
}>();
const model = defineModel<AccessRule>({ required: true });

const SEE_KINDS = [
  { label: "Everyone", value: "everyone" },
  { label: "Only these roles", value: "roles" },
];
const POST_KINDS = [
  { label: "Everyone who can see", value: "everyone" },
  { label: "Only these roles", value: "roles" },
  { label: "Nobody (read-only)", value: "nobody" },
];

const roleItems = computed(() =>
  props.roles.map((r) => ({
    label:
      r.name +
      (r.managed ? " (integration)" : "") +
      (r.admin ? " (Administrator)" : "") +
      (props.botTopPosition !== null && r.position > props.botTopPosition ? " — above the bot's top role" : ""),
    value: r.id,
  })),
);
// Posters must be able to see: when see is roles, only offer those roles.
const posterItems = computed(() =>
  model.value.see.kind === "roles"
    ? roleItems.value.filter((i) => (model.value.see as { roleIds: string[] }).roleIds.includes(i.value))
    : roleItems.value,
);

const setSeeKind = (kind: "everyone" | "roles") => {
  model.value = { ...model.value, see: kind === "everyone" ? { kind } : { kind, roleIds: [] } };
};
const setSeeRoles = (roleIds: string[]) => {
  model.value = { ...model.value, see: { kind: "roles", roleIds } };
};
const setPostKind = (kind: "everyone" | "roles" | "nobody") => {
  model.value = { ...model.value, post: kind === "roles" ? { kind, roleIds: [] } : { kind } };
};
const setPostRoles = (roleIds: string[]) => {
  model.value = { ...model.value, post: { kind: "roles", roleIds } };
};
</script>
