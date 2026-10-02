<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-user-check"
      title="Auto Roles"
      description="Grant roles automatically to members who meet your requirements."
      :enabled="isModuleEnabled('autoroles')"
    />

    <DashboardModuleSection
      title="Rules"
      description="A member gets the role once they meet every requirement in a rule. Roles are only ever added: if you remove one by hand, it stays removed."
    >
      <template #actions>
        <UButton
          color="primary"
          size="sm"
          icon="i-lucide-plus"
          :disabled="settings.rules.length >= MAX_RULES"
          @click="openCreate"
        >
          New rule
        </UButton>
      </template>

      <div
        v-if="settings.rules.length === 0"
        class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
        >
          <UIcon name="i-lucide-user-check" class="h-5 w-5 text-sky-200" />
        </span>
        <div>
          <h4 class="text-sm font-semibold text-white">No rules yet</h4>
          <p class="mx-auto mt-1 max-w-sm text-[13px] text-gray-400">
            For example: members who reach level 5 and have been here for a week get the
            Regular role.
          </p>
        </div>
        <UButton color="primary" icon="i-lucide-plus" @click="openCreate">
          Create your first rule
        </UButton>
      </div>

      <ul v-else class="-mx-2 divide-y divide-white/[0.06]">
        <li
          v-for="rule in settings.rules"
          :key="rule.id"
          class="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-3 transition-opacity"
          :class="rule.enabled ? '' : 'opacity-60'"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            :class="rule.enabled ? 'bg-sky-200/10 text-sky-200' : 'bg-white/[0.04] text-gray-500'"
          >
            <UIcon name="i-lucide-user-check" class="h-4 w-4" />
          </span>

          <div class="min-w-0 flex-1 basis-48">
            <button
              type="button"
              class="block max-w-full truncate text-left text-sm font-medium text-white hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300"
              @click="openEdit(rule)"
            >
              {{ rule.name }}
            </button>
            <p v-if="roleWarning(rule.roleId)" class="mt-0.5 flex items-center gap-1 text-[13px] text-amber-200">
              <UIcon name="i-lucide-triangle-alert" class="h-3.5 w-3.5 shrink-0" />
              {{ roleWarning(rule.roleId) }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <span
              v-for="(req, i) in rule.requirements"
              :key="i"
              class="inline-flex items-center rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-gray-300"
            >
              {{ describeRequirement(req) }}
            </span>
            <UIcon name="i-lucide-arrow-right" class="h-3.5 w-3.5 text-gray-600" />
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ring-white/10"
              :style="{ color: roleColor(rule.roleId) }"
            >
              <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: roleColor(rule.roleId) }" />
              {{ roleName(rule.roleId) }}
            </span>
          </div>

          <div class="ml-auto flex items-center gap-1">
            <USwitch
              v-model="rule.enabled"
              size="sm"
              :aria-label="`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`"
            />
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-pencil"
              :aria-label="`Edit ${rule.name}`"
              @click="openEdit(rule)"
            />
            <UButton
              variant="ghost"
              color="error"
              size="sm"
              icon="i-lucide-trash-2"
              :aria-label="`Delete ${rule.name}`"
              @click="deleteTarget = rule"
            />
          </div>
        </li>
      </ul>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="autoroles" />

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />

    <!-- ── Create / edit rule ── -->
    <UModal
      :open="!!draft"
      :title="draftIsNew ? 'New rule' : 'Edit rule'"
      description="A member must meet every requirement."
      @update:open="(v: boolean) => !v && (draft = null)"
    >
      <template #body>
        <div v-if="draft" class="space-y-5">
          <UFormField label="Rule name" class="w-full">
            <UInput v-model="draft.name" placeholder="e.g. Regulars" class="w-full" maxlength="80" autofocus />
          </UFormField>

          <UFormField label="Role to grant" class="w-full">
            <div v-if="state.rolesLoading" class="flex items-center gap-2 py-1.5 text-gray-400">
              <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
              <span class="text-sm">Loading roles…</span>
            </div>
            <USelectMenu
              v-else-if="grantableRoleOptions.length > 0"
              v-model="draft.roleId"
              :items="grantableRoleOptions"
              value-key="value"
              placeholder="Select a role…"
              searchable
              icon="i-lucide-users"
              class="w-full"
            />
            <p v-else class="py-1.5 text-sm italic text-gray-500">No roles available.</p>
            <p
              v-if="draft.roleId && roleWarning(draft.roleId)"
              class="mt-1.5 flex items-start gap-1.5 text-[13px] text-amber-200"
            >
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {{ roleWarning(draft.roleId) }}
            </p>
            <p v-if="roleChangedOnEdit" class="mt-1.5 text-[13px] text-gray-400">
              Changing the role gives it to everyone who already qualifies; members keep roles they already received.
            </p>
          </UFormField>

          <div class="space-y-2">
            <span class="block text-sm font-medium text-white">Requirements</span>
            <div
              v-for="(req, i) in draft.requirements"
              :key="i"
              class="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.03] p-2 ring-1 ring-inset ring-white/10"
            >
              <USelect
                :model-value="req.type"
                :items="requirementTypeItems"
                value-key="value"
                class="w-44"
                @update:model-value="(t: RequirementType) => (draft!.requirements[i] = newRequirement(t))"
              />
              <UInput
                v-if="req.type === 'level'"
                v-model.number="req.level"
                type="number"
                min="1"
                max="1000"
                class="w-28"
                aria-label="Level"
              />
              <UInput
                v-else-if="req.type === 'tenure_days' || req.type === 'account_age_days'"
                v-model.number="req.days"
                type="number"
                min="1"
                class="w-28"
                aria-label="Days"
              />
              <span class="min-w-0 flex-1 text-[13px] text-gray-400">
                {{ REQUIREMENT_TYPES.find((t) => t.value === req.type)?.description }}
              </span>
              <UButton
                variant="ghost"
                color="error"
                size="sm"
                icon="i-lucide-x"
                aria-label="Remove requirement"
                @click="draft.requirements.splice(i, 1)"
              />
            </div>
            <UButton
              variant="soft"
              size="sm"
              icon="i-lucide-plus"
              :disabled="draft.requirements.length >= MAX_REQUIREMENTS"
              @click="draft.requirements.push(newRequirement('level'))"
            >
              Add requirement
            </UButton>
          </div>

          <p
            v-if="draftError"
            class="flex items-start gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
          >
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
            {{ draftError }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="draft = null">Cancel</UButton>
          <UButton color="primary" :disabled="!!draftError" @click="commitDraft">
            {{ draftIsNew ? "Add rule" : "Apply changes" }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ── Delete confirmation ── -->
    <UModal :open="!!deleteTarget" @update:open="(v: boolean) => !v && (deleteTarget = null)">
      <template #content>
        <div class="space-y-4 p-6">
          <div class="flex items-center gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-400/10 ring-1 ring-inset ring-red-400/30"
            >
              <UIcon name="i-lucide-triangle-alert" class="h-5 w-5 text-red-300" />
            </span>
            <div>
              <h3 class="text-base font-semibold text-white">Delete rule</h3>
              <p class="text-[13px] text-gray-400">Applies when you save.</p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            Delete <strong class="text-white">{{ deleteTarget?.name || "this rule" }}</strong>?
            Members keep any roles they already received.
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton color="neutral" variant="ghost" @click="deleteTarget = null">Cancel</UButton>
            <UButton color="error" icon="i-lucide-trash-2" @click="confirmDelete">Delete rule</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import {
  MAX_REQUIREMENTS,
  MAX_RULES,
  REQUIREMENT_TYPES,
  describeRequirement,
  newRequirement,
  reissueIdIfRoleChanged,
  roleProblem,
  toSavedRule,
  validateRule,
  type AutoRoleRule,
  type RequirementType,
} from "~/utils/autoroles";

const route = useRoute();
const guildId = route.params.guild_id as string;
const { state, isModuleEnabled, saveModuleSettings, getModuleConfig, loadRoles } =
  useServerSettings(guildId);

const saving = ref(false);
const settings = reactive<{ rules: AutoRoleRule[] }>({ rules: [] });

// Last loaded/saved values (JSON); drives the unsaved-changes bar and Discard.
const baseline = ref(JSON.stringify(settings));
const dirty = computed(() => JSON.stringify(settings) !== baseline.value);

const draft = ref<AutoRoleRule | null>(null);
const draftIsNew = ref(false);
const deleteTarget = ref<AutoRoleRule | null>(null);

const requirementTypeItems = REQUIREMENT_TYPES.map((t) => ({ label: t.label, value: t.value }));

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Roles ────────────────────────────────────────────────────────────

const roleById = computed(() => new Map(state.value.roles.map((r) => [r.id, r])));

// Managed roles and @everyone (id === guild id) can never be granted.
const grantableRoleOptions = computed(() =>
  state.value.roles
    .filter((r) => !r.managed && r.id !== guildId)
    .map((r) => ({ label: `@${r.name}`, value: r.id })),
);

const roleName = (roleId: string) => {
  const role = roleById.value.get(roleId);
  return role ? `@${role.name}` : "Unknown role";
};

const roleColor = (roleId: string) => {
  const color = roleById.value.get(roleId)?.color;
  return color ? `#${color.toString(16).padStart(6, "0")}` : "#99aab5";
};

const roleWarning = (roleId: string): string | null => {
  if (state.value.rolesLoading || state.value.roles.length === 0) return null;
  return roleProblem(roleById.value.get(roleId), {
    guildId,
    botTopPosition: state.value.botTopPosition,
  });
};

// ── Rule editing ─────────────────────────────────────────────────────

const draftError = computed(() => (draft.value ? validateRule(draft.value) : null));

// Editing an existing rule and picking a different role re-grants it (see commitDraft).
const roleChangedOnEdit = computed(() => {
  if (!draft.value || draftIsNew.value) return false;
  const original = settings.rules.find((r) => r.id === draft.value!.id);
  return !!original && original.roleId !== draft.value.roleId;
});

function openCreate() {
  draftIsNew.value = true;
  draft.value = {
    id: uid(),
    name: "",
    enabled: true,
    roleId: "",
    requirements: [newRequirement("level")],
  };
}

function openEdit(rule: AutoRoleRule) {
  draftIsNew.value = false;
  draft.value = JSON.parse(JSON.stringify(rule)) as AutoRoleRule;
}

function commitDraft() {
  if (!draft.value || validateRule(draft.value)) return;
  const idx = settings.rules.findIndex((r) => r.id === draft.value!.id);
  if (idx === -1) settings.rules.push(draft.value);
  else settings.rules[idx] = reissueIdIfRoleChanged(settings.rules[idx]!, draft.value, uid());
  draft.value = null;
}

function confirmDelete() {
  if (deleteTarget.value) {
    settings.rules = settings.rules.filter((r) => r.id !== deleteTarget.value!.id);
  }
  deleteTarget.value = null;
}

// ── Save ─────────────────────────────────────────────────────────────

const save = async () => {
  saving.value = true;
  const ok = await saveModuleSettings("autoroles", {
    rules: settings.rules.map(toSavedRule),
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) baseline.value = JSON.stringify(settings);
  saving.value = false;
};

const discard = () => {
  const b = JSON.parse(baseline.value) as { rules: AutoRoleRule[] };
  settings.rules = b.rules;
};

// ── Init ─────────────────────────────────────────────────────────────

onMounted(async () => {
  const saved = getModuleConfig("autoroles");
  if (saved?.rules && Array.isArray(saved.rules)) {
    settings.rules = saved.rules.map((r: any) => ({
      id: r.id ?? uid(),
      name: r.name ?? "Unnamed rule",
      enabled: r.enabled ?? true,
      roleId: r.roleId ?? "",
      requirements: Array.isArray(r.requirements) ? r.requirements : [],
    }));
  }
  baseline.value = JSON.stringify(settings);
  await loadRoles();
});
</script>
