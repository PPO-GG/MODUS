<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-funnel"
      title="AutoMod Rules"
      description="IF/THEN rules that moderate your server automatically."
      :enabled="isModuleEnabled('automod')"
    />

    <!-- ── Draft with AI ── -->
    <DashboardModuleSection
      title="Draft with AI"
      description="Describe a rule in plain English. You review and edit the draft before anything is saved."
    >
      <AutomodDraftBox :guild-id="guildId" @draft="applyDraft" />
    </DashboardModuleSection>

    <!-- ── Rules ── -->
    <DashboardModuleSection
      title="Rules"
      :description="rulesSummary"
    >
      <template #actions>
        <UButton color="primary" size="sm" icon="i-lucide-plus" @click="openCreateModal()">
          New rule
        </UButton>
      </template>

      <div v-if="loading" class="space-y-2" aria-busy="true">
        <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-lg bg-white/[0.04]" />
      </div>

      <div
        v-else-if="rules.length === 0"
        class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
        >
          <UIcon name="i-lucide-funnel" class="h-5 w-5 text-sky-200" />
        </span>
        <div>
          <h4 class="text-sm font-semibold text-white">No rules yet</h4>
          <p class="mx-auto mt-1 max-w-sm text-[13px] text-gray-400">
            Create your first rule. For example: if a message contains profanity, delete it and
            warn the user.
          </p>
        </div>
        <UButton color="primary" icon="i-lucide-plus" @click="openCreateModal()">
          Create your first rule
        </UButton>
      </div>

      <ul v-else class="-mx-2 divide-y divide-white/[0.06]">
        <li
          v-for="rule in rules"
          :key="rule.$id"
          class="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-3 transition-opacity"
          :class="rule.enabled ? '' : 'opacity-60'"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            :class="rule.enabled ? 'bg-sky-200/10 text-sky-200' : 'bg-white/[0.04] text-gray-500'"
          >
            <UIcon :name="triggerIcon(rule.trigger)" class="h-4 w-4" />
          </span>

          <div class="min-w-0 flex-1 basis-48">
            <button
              type="button"
              class="block max-w-full truncate text-left text-sm font-medium text-white hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300"
              @click="openEditModal(rule)"
            >
              {{ rule.name }}
            </button>
            <p class="mt-0.5 text-[13px] text-gray-400">
              When {{ triggerLabel(rule.trigger).toLowerCase() }}
              <span v-if="rule.cooldown"> · {{ rule.cooldown }}s cooldown</span>
              <span v-if="rule.priority > 0"> · priority {{ rule.priority }}</span>
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <span
              class="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-gray-300"
            >
              If {{ countConditions(rule) }} condition{{ countConditions(rule) !== 1 ? "s" : "" }}
            </span>
            <UIcon name="i-lucide-arrow-right" class="h-3.5 w-3.5 text-gray-600" />
            <template v-if="parseActions(rule).length > 0">
              <span
                v-for="(action, i) in parseActions(rule)"
                :key="`${action.type}-${i}`"
                class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
                :class="actionChipClass(action.type)"
              >
                <UIcon :name="actionIcon(action.type)" class="h-3 w-3" />
                {{ actionLabel(action.type) }}
              </span>
            </template>
            <span v-else class="text-xs italic text-gray-500">No actions</span>
          </div>

          <div class="ml-auto flex items-center gap-1">
            <USwitch
              :model-value="rule.enabled"
              size="sm"
              :aria-label="`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`"
              @update:model-value="(val: boolean) => toggleRule(rule, val)"
            />
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-pencil"
              :aria-label="`Edit ${rule.name}`"
              @click="openEditModal(rule)"
            />
            <UButton
              variant="ghost"
              color="error"
              size="sm"
              icon="i-lucide-trash-2"
              :aria-label="`Delete ${rule.name}`"
              @click="confirmDelete(rule)"
            />
          </div>
        </li>
      </ul>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="automod" />

    <!-- ── Create / Edit slide-over ── -->
    <USlideover
      v-model:open="showModal"
      :title="editingRule ? 'Edit rule' : 'Create rule'"
      description="Choose when the rule runs, what it checks and what it does."
      :ui="{ content: 'sm:max-w-3xl' }"
    >
      <template #body>
        <div class="space-y-6">
          <template v-if="draftInfo">
            <UAlert
              color="info"
              variant="subtle"
              icon="i-lucide-sparkles"
              title="AI draft: review before saving"
              description="Check the trigger, conditions and actions below. Nothing is saved until you click Save."
            />
            <UAlert
              v-for="warning in draftInfo.warnings"
              :key="warning"
              color="warning"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :title="warning"
            />
            <UAlert
              v-if="draftInfo.notes.length"
              color="neutral"
              variant="subtle"
              icon="i-lucide-info"
              title="Notes from the AI"
            >
              <template #description>
                <ul class="mt-1 list-disc space-y-0.5 pl-4 text-[13px]">
                  <li v-for="note in draftInfo.notes" :key="note">{{ note }}</li>
                </ul>
              </template>
            </UAlert>
          </template>

          <UFormField label="Rule name" class="w-full">
            <UInput
              v-model="form.name"
              placeholder="e.g. Profanity filter, Anti-spam"
              icon="i-lucide-tag"
              class="w-full"
            />
          </UFormField>

          <QuickCreateForm
            v-if="quickCreateMode"
            ref="quickCreateRef"
            :trigger-groups="triggerGroups"
            :action-options="quickCreateActionOptions"
            @promote="
              (payload) => {
                promoteToFullEditor(payload);
              }
            "
          />
          <RuleTimeline
            v-else
            v-model:trigger="form.trigger"
            v-model:conditions="form.conditions"
            v-model:actions="form.actions"
            :trigger-groups="triggerGroups"
            :action-options="actionOptions"
            :channel-options="channelOptions"
            :role-options="roleOptions"
            :trigger-label="triggerLabel"
          />

          <!-- Limits & exceptions -->
          <UAccordion :items="advancedItems">
            <template #body>
              <div class="grid grid-cols-1 gap-x-6 gap-y-5 pb-2 pt-1 md:grid-cols-2">
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-white">
                    Cooldown
                    <span class="ml-1 text-sky-200">{{
                      form.cooldown === 0 ? "None" : `${form.cooldown}s`
                    }}</span>
                  </label>
                  <div class="flex items-center gap-3">
                    <USlider v-model="form.cooldown" :min="0" :max="3600" :step="5" class="flex-1" />
                    <UInput
                      v-model.number="form.cooldown"
                      type="number"
                      :min="0"
                      :max="3600"
                      size="sm"
                      class="w-20"
                    />
                  </div>
                  <p class="text-[13px] text-gray-400">
                    Seconds between re-triggers per user (max 1 hour). Prevents rule spam.
                  </p>
                </div>

                <div class="space-y-2">
                  <label class="block text-sm font-medium text-white">
                    Priority
                    <span class="ml-1 text-sky-200">{{ form.priority }}</span>
                  </label>
                  <div class="flex items-center gap-3">
                    <USlider v-model="form.priority" :min="0" :max="10" :step="1" class="flex-1" />
                    <UInput
                      v-model.number="form.priority"
                      type="number"
                      :min="0"
                      :max="10"
                      size="sm"
                      class="w-20"
                    />
                  </div>
                  <p class="text-[13px] text-gray-400">0 (highest) – 10 (lowest). Lower runs first.</p>
                </div>

                <div class="space-y-2">
                  <label class="block text-sm font-medium text-white">Exempt roles</label>
                  <USelectMenu
                    v-if="roleOptions.length > 0"
                    v-model="form.exemptRoles"
                    :items="roleOptions"
                    value-key="value"
                    multiple
                    placeholder="Roles immune to this rule…"
                    class="w-full"
                  />
                  <UInput
                    v-else
                    v-model="form.exemptRolesInput"
                    placeholder="Role IDs, comma separated"
                    class="w-full"
                  />
                  <div
                    v-if="roleOptions.length > 0 && form.exemptRoles.length > 0"
                    class="flex flex-wrap gap-1.5"
                  >
                    <span
                      v-for="id in form.exemptRoles"
                      :key="id"
                      class="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-gray-300 ring-1 ring-inset ring-white/10"
                    >
                      {{ roleLabel(id) }}
                      <button
                        type="button"
                        class="text-gray-500 hover:text-red-400"
                        :aria-label="`Remove ${roleLabel(id)}`"
                        @click="removeExemptRole(id)"
                      >
                        <UIcon name="i-lucide-x" class="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                  <p class="text-[13px] text-gray-400">These roles bypass this rule entirely.</p>
                </div>

                <div class="space-y-2">
                  <label class="block text-sm font-medium text-white">Exempt channels</label>
                  <USelectMenu
                    v-if="channelOptions.length > 0"
                    v-model="form.exemptChannels"
                    :items="channelOptions"
                    value-key="value"
                    multiple
                    placeholder="Channels where this rule won't apply…"
                    class="w-full"
                  />
                  <UInput
                    v-else
                    v-model="form.exemptChannelsInput"
                    placeholder="Channel IDs, comma separated"
                    class="w-full"
                  />
                  <div
                    v-if="channelOptions.length > 0 && form.exemptChannels.length > 0"
                    class="flex flex-wrap gap-1.5"
                  >
                    <span
                      v-for="id in form.exemptChannels"
                      :key="id"
                      class="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-gray-300 ring-1 ring-inset ring-white/10"
                    >
                      #{{ channelLabel(id) }}
                      <button
                        type="button"
                        class="text-gray-500 hover:text-red-400"
                        :aria-label="`Remove ${channelLabel(id)}`"
                        @click="removeExemptChannel(id)"
                      >
                        <UIcon name="i-lucide-x" class="h-3 w-3" />
                      </button>
                    </span>
                  </div>
                  <p class="text-[13px] text-gray-400">This rule won't fire in these channels.</p>
                </div>
              </div>
            </template>
          </UAccordion>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showModal = false">Cancel</UButton>
          <UButton color="primary" :loading="saving" icon="i-lucide-check" @click="saveRule">
            {{ editingRule ? "Save changes" : "Create rule" }}
          </UButton>
        </div>
      </template>
    </USlideover>

    <!-- ── Delete confirmation ── -->
    <UModal v-model:open="showDeleteModal">
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
              <p class="text-[13px] text-gray-400">This can't be undone.</p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            Delete <strong class="text-white">{{ deletingRule?.name }}</strong>?
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton color="neutral" variant="ghost" @click="showDeleteModal = false">
              Cancel
            </UButton>
            <UButton color="error" :loading="deleting" icon="i-lucide-trash-2" @click="deleteRule()">
              Delete rule
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import RuleTimeline from "~/components/automod/RuleTimeline.vue";
import QuickCreateForm from "~/components/automod/QuickCreateForm.vue";
import AutomodDraftBox from "~/components/automod/AutomodDraftBox.vue";
import { draftToFormState, type DraftResult } from "~/utils/automod-draft";
import {
  triggerGroups,
  actionOptions,
  triggerIcon,
  triggerLabel,
  actionIcon,
  actionLabel,
  actionChipClass,
} from "~/utils/automod-meta";

const route = useRoute();
const guildId = route.params.guild_id as string;
const {
  isModuleEnabled,
  loadChannels,
  loadRoles,
  channelOptions,
  roleOptions,
} = useServerSettings(guildId);

const toast = useToast();

// ── State ──
const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const rules = ref<any[]>([]);
const showModal = ref(false);
const showDeleteModal = ref(false);
const editingRule = ref<any>(null);
const deletingRule = ref<any>(null);
const quickCreateMode = ref(true);
const draftInfo = ref<{ warnings: string[]; notes: string[] } | null>(null);
const quickCreateRef = ref<InstanceType<typeof QuickCreateForm> | null>(null);

const rulesSummary = computed(() => {
  if (loading.value) return "Loading rules…";
  const active = rules.value.filter((r) => r.enabled).length;
  return `${rules.value.length} rule${rules.value.length !== 1 ? "s" : ""}, ${active} active.`;
});

// ── Form ──
interface ActionForm {
  type: string;
  params: Record<string, any>;
  delaySeconds?: number;
}

interface Condition {
  type: "condition";
  field: string;
  operator: string;
  value: string | number | boolean | string[];
  flags?: string[];
}

interface ConditionGroup {
  operator: "AND" | "OR";
  conditions: (Condition | ConditionGroup)[];
}

const defaultConditions = (): ConditionGroup => ({
  operator: "AND",
  conditions: [
    {
      type: "condition",
      field: "message.content",
      operator: "contains",
      value: "",
      flags: ["case_insensitive"],
    },
  ],
});

interface RuleForm {
  name: string;
  trigger: string;
  conditions: ConditionGroup;
  actions: ActionForm[];
  cooldown: number;
  priority: number;
  exemptRoles: string[];
  exemptChannels: string[];
  exemptRolesInput: string;
  exemptChannelsInput: string;
}

const form = ref<RuleForm>({
  name: "",
  trigger: "message_create",
  conditions: defaultConditions(),
  actions: [],
  cooldown: 0,
  priority: 0,
  exemptRoles: [],
  exemptChannels: [],
  exemptRolesInput: "",
  exemptChannelsInput: "",
});

// Quick-Create has no UI for filling in action-specific params, so only
// offer actions that are fully functional with empty params.
const quickCreateActionOptions = actionOptions.filter((a) =>
  ["delete_message", "warn_user", "log_to_modlog"].includes(a.value),
);

const advancedItems = [
  {
    label: "Limits & exceptions",
    icon: "i-lucide-sliders-horizontal",
    defaultOpen: false,
  },
];

// ── Helpers ──
const roleLabel = (id: string) =>
  roleOptions.value.find((r) => r.value === id)?.label ?? id;

const channelLabel = (id: string) =>
  channelOptions.value.find((c) => c.value === id)?.label ?? id;

const removeExemptRole = (id: string) => {
  form.value.exemptRoles = form.value.exemptRoles.filter((r) => r !== id);
};

const removeExemptChannel = (id: string) => {
  form.value.exemptChannels = form.value.exemptChannels.filter(
    (c) => c !== id,
  );
};

const parseActions = (rule: any): ActionForm[] => {
  try {
    return JSON.parse(rule.actions);
  } catch {
    return [];
  }
};

const countConditions = (rule: any): number => {
  try {
    const conds = JSON.parse(rule.conditions);
    const count = (group: any): number => {
      if (!group.conditions) return 0;
      return group.conditions.reduce((acc: number, c: any) => {
        if (c.type === "condition") return acc + 1;
        return acc + count(c);
      }, 0);
    };
    return count(conds);
  } catch {
    return 0;
  }
};

// ── CRUD ──
const fetchRules = async () => {
  loading.value = true;
  try {
    const { documents } = await $fetch<{ documents: any[]; total: number }>(
      `/api/automod?guild_id=${encodeURIComponent(guildId)}`,
    );
    rules.value = documents;
  } catch (error) {
    console.error("Error fetching automod rules:", error);
    toast.add({
      title: "Error",
      description: "Failed to load automod rules.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  draftInfo.value = null;
  editingRule.value = null;
  quickCreateMode.value = true;
  form.value = {
    name: "",
    trigger: "message_create",
    conditions: defaultConditions(),
    actions: [],
    cooldown: 0,
    priority: 0,
    exemptRoles: [],
    exemptChannels: [],
    exemptRolesInput: "",
    exemptChannelsInput: "",
  };
  showModal.value = true;
};

const promoteToFullEditor = (payload: {
  trigger: string;
  conditions: ConditionGroup;
  actions: ActionForm[];
}) => {
  form.value.trigger = payload.trigger;
  form.value.conditions = payload.conditions;
  form.value.actions = payload.actions;
  quickCreateMode.value = false;
};

const applyDraft = (result: DraftResult) => {
  editingRule.value = null;
  quickCreateMode.value = false;
  form.value = draftToFormState(result.rule);
  draftInfo.value = { warnings: result.warnings, notes: result.notes };
  showModal.value = true;
};

const openEditModal = (rule: any) => {
  draftInfo.value = null;
  editingRule.value = rule;
  quickCreateMode.value = false;
  const conditions = JSON.parse(rule.conditions);
  const actions = JSON.parse(rule.actions).map((a: any) => {
    const params = a.params ?? {};
    // Re-hydrate timeout UI fields from stored duration string (e.g. "30m" → amt=30, unit="m")
    if (a.type === "timeout_user" && params.duration) {
      const match = String(params.duration).match(/^(\d+)([mhd])$/);
      if (match) {
        params._durationAmt = parseInt(match[1] as string, 10);
        params._durationUnit = match[2] as string;
      }
    }
    // Re-hydrate ban delete_days default
    if (a.type === "ban_user" && params.delete_days === undefined) {
      params.delete_days = 0;
    }
    return { type: a.type, params, delaySeconds: a.delaySeconds };
  });
  const exemptRoles = rule.exempt_roles ? JSON.parse(rule.exempt_roles) : [];
  const exemptChannels = rule.exempt_channels
    ? JSON.parse(rule.exempt_channels)
    : [];

  form.value = {
    name: rule.name,
    trigger: rule.trigger,
    conditions,
    actions,
    cooldown: rule.cooldown ?? 0,
    priority: Math.min(rule.priority ?? 0, 10),
    exemptRoles,
    exemptChannels,
    exemptRolesInput: exemptRoles.join(", "),
    exemptChannelsInput: exemptChannels.join(", "),
  };
  showModal.value = true;
};

const hasEmptyConditionValue = (group: ConditionGroup): boolean => {
  return group.conditions.some((c) => {
    if ("type" in c && c.type === "condition") {
      return typeof c.value === "string" && c.value === "";
    }
    return hasEmptyConditionValue(c as ConditionGroup);
  });
};

const saveRule = async () => {
  if (!form.value.name.trim()) {
    toast.add({
      title: "Validation",
      description: "Please enter a rule name.",
      color: "warning",
    });
    return;
  }

  if (quickCreateMode.value) {
    quickCreateRef.value?.promote();
  }

  if (form.value.actions.length === 0) {
    toast.add({
      title: "Validation",
      description: "Add at least one action.",
      color: "warning",
    });
    return;
  }

  if (hasEmptyConditionValue(form.value.conditions)) {
    toast.add({
      title: "Validation",
      description: "Please fill in a value for every condition.",
      color: "warning",
    });
    return;
  }

  saving.value = true;

  const exemptRoles =
    roleOptions.value.length > 0
      ? form.value.exemptRoles
      : form.value.exemptRolesInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  const exemptChannels =
    channelOptions.value.length > 0
      ? form.value.exemptChannels
      : form.value.exemptChannelsInput
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  const payload = {
    guild_id: guildId,
    name: form.value.name,
    enabled: editingRule.value ? editingRule.value.enabled : true,
    priority: form.value.priority,
    trigger: form.value.trigger,
    conditions: JSON.stringify(form.value.conditions),
    actions: JSON.stringify(
      form.value.actions.map((a) => {
        // Strip internal UI-only duration picker fields before persisting
        const { _durationAmt, _durationUnit, ...cleanParams } = a.params;
        const hasParams = Object.keys(cleanParams).length > 0;
        return {
          type: a.type,
          ...(hasParams ? { params: cleanParams } : {}),
          ...(a.delaySeconds && a.delaySeconds > 0
            ? { delaySeconds: a.delaySeconds }
            : {}),
        };
      }),
    ),
    exempt_roles: JSON.stringify(exemptRoles),
    exempt_channels: JSON.stringify(exemptChannels),
    cooldown: form.value.cooldown,
    updated_at: new Date().toISOString(),
  };

  try {
    if (editingRule.value) {
      await $fetch(
        `/api/automod/${encodeURIComponent(editingRule.value.$id)}`,
        { method: "PUT", body: payload },
      );
      toast.add({
        title: "Rule Updated",
        description: `"${form.value.name}" has been updated.`,
        color: "success",
      });
    } else {
      await $fetch("/api/automod", { method: "POST", body: payload });
      toast.add({
        title: "Rule Created",
        description: `"${form.value.name}" has been created.`,
        color: "success",
      });
    }

    showModal.value = false;
    await fetchRules();
  } catch (error) {
    console.error("Error saving rule:", error);
    toast.add({
      title: "Error",
      description: "Failed to save rule. Please try again.",
      color: "error",
    });
  } finally {
    saving.value = false;
  }
};

const toggleRule = async (rule: any, enabled: boolean) => {
  try {
    await $fetch(`/api/automod/${encodeURIComponent(rule.$id)}`, {
      method: "PUT",
      body: { enabled },
    });
    rule.enabled = enabled;
    toast.add({
      title: enabled ? "Rule Enabled" : "Rule Disabled",
      description: `"${rule.name}" is now ${enabled ? "active" : "inactive"}.`,
      color: "success",
    });
  } catch (error) {
    console.error("Error toggling rule:", error);
    toast.add({
      title: "Error",
      description: "Failed to update rule.",
      color: "error",
    });
  }
};

const confirmDelete = (rule: any) => {
  deletingRule.value = rule;
  showDeleteModal.value = true;
};

const deleteRule = async () => {
  if (!deletingRule.value) return;
  deleting.value = true;
  try {
    await $fetch(
      `/api/automod/${encodeURIComponent(deletingRule.value.$id)}`,
      { method: "DELETE" },
    );
    toast.add({
      title: "Rule Deleted",
      description: `"${deletingRule.value.name}" has been removed.`,
      color: "success",
    });
    showDeleteModal.value = false;
    await fetchRules();
  } catch (error) {
    console.error("Error deleting rule:", error);
    toast.add({
      title: "Error",
      description: "Failed to delete rule.",
      color: "error",
    });
  } finally {
    deleting.value = false;
  }
};

// ── Init ──
onMounted(async () => {
  loadChannels();
  loadRoles();
  await fetchRules();
});
</script>
