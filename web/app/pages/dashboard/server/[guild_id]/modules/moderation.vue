<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-shield-alert"
      title="Moderation"
      description="Case logging, warning escalation and who can use each command."
      :enabled="isModuleEnabled('Moderation')"
    />

    <DashboardModuleSection
      title="Logging & notifications"
      description="Where moderation actions are recorded, and whether users are told."
    >
      <div class="space-y-5">
        <UFormField label="Mod log channel" class="w-full">
          <div v-if="channelsLoading" class="flex items-center gap-2 py-2 text-gray-400">
            <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
            <span class="text-sm">Loading channels…</span>
          </div>
          <USelectMenu
            v-else-if="channels.length > 0"
            v-model="form.modLogChannelId"
            :items="[{ label: 'None (disabled)', value: 'none' }, ...channelOptions]"
            value-key="value"
            placeholder="Select a mod log channel…"
            icon="i-lucide-hash"
            class="w-full"
          />
          <UButton
            v-else
            variant="soft"
            color="neutral"
            size="xs"
            icon="i-lucide-rotate-cw"
            @click="loadChannels()"
          >
            Load channels
          </UButton>
        </UFormField>
        <p
          v-if="!channelsLoading && channels.length > 0 && form.modLogChannelId === 'none'"
          class="flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
        >
          <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
          No mod log channel selected. Moderation actions won't be logged to a channel.
        </p>

        <label
          class="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-white">DM users when they're moderated</span>
            <span class="block text-[13px] text-gray-400">
              Send a direct message with the action and reason.
            </span>
          </span>
          <USwitch v-model="form.dmOnAction" aria-label="DM users when they're moderated" />
        </label>
      </div>
    </DashboardModuleSection>

    <DashboardModuleSection
      title="Warnings"
      description="Escalate automatically when a user collects enough warnings."
    >
      <div class="space-y-5">
        <div>
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <label class="text-sm font-medium text-white" for="warn-threshold">
              Warning threshold
            </label>
            <span class="text-sm text-sky-200">
              {{
                form.warnThreshold === 0
                  ? "Off"
                  : `${form.warnThreshold} warning${form.warnThreshold !== 1 ? "s" : ""}`
              }}
            </span>
          </div>
          <USlider id="warn-threshold" v-model="form.warnThreshold" :min="0" :max="10" :step="1" />
          <p class="mt-2 text-[13px] text-gray-400">Set to 0 to disable auto-actions.</p>
        </div>

        <template v-if="form.warnThreshold > 0">
          <div>
            <span class="mb-2 block text-sm font-medium text-white">Auto-action</span>
            <div
              class="grid grid-cols-1 gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Auto-action"
            >
              <label
                v-for="opt in warnActionOptions"
                :key="opt.value"
                class="block cursor-pointer"
              >
                <input
                  v-model="form.warnAction"
                  type="radio"
                  name="moderation-warn-action"
                  :value="opt.value"
                  class="peer sr-only"
                />
                <div
                  class="flex h-full items-start gap-3 rounded-xl p-3.5 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
                  :class="opt.selectedClass"
                >
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    :class="opt.iconClass"
                  >
                    <UIcon :name="opt.icon" class="h-4 w-4" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-semibold text-white">{{ opt.label }}</span>
                    <span class="block text-[13px] leading-relaxed text-gray-400">
                      {{ opt.description }}
                    </span>
                  </span>
                  <UIcon
                    v-if="form.warnAction === opt.value"
                    name="i-lucide-circle-check"
                    class="h-5 w-5 shrink-0"
                    :class="opt.checkClass"
                  />
                </div>
              </label>
            </div>
          </div>

          <div v-if="form.warnAction === 'timeout'">
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <label class="text-sm font-medium text-white" for="auto-timeout">
                Timeout duration
              </label>
              <span class="text-sm text-sky-200">{{ formatMinutes(form.autoTimeoutDuration) }}</span>
            </div>
            <USlider
              id="auto-timeout"
              v-model="form.autoTimeoutDuration"
              :min="1"
              :max="1440"
              :step="1"
            />
          </div>

          <p
            class="flex items-center gap-2 rounded-lg bg-sky-200/[0.06] px-3 py-2 text-[13px] text-sky-200"
          >
            <UIcon name="i-lucide-info" class="h-4 w-4 shrink-0" />
            {{ warnSummary }}
          </p>
        </template>
      </div>
    </DashboardModuleSection>

    <DashboardModuleSection
      title="Command permissions"
      description="Limit each command group to specific roles. Leave empty to allow anyone with the matching Discord permission."
    >
      <div v-if="rolesLoading" class="flex items-center gap-2 py-2 text-gray-400">
        <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
        <span class="text-sm">Loading server roles…</span>
      </div>
      <div v-else-if="roleOptions.length > 0" class="-mx-2 divide-y divide-white/[0.06]">
        <div
          v-for="group in commandPermissionGroups"
          :key="group.key"
          class="flex flex-col gap-2 px-2 py-3 sm:flex-row sm:items-center sm:gap-4"
        >
          <div class="sm:w-56 sm:shrink-0">
            <div class="text-sm font-medium text-white">{{ group.label }}</div>
            <code class="text-xs text-gray-400">{{ group.commands }}</code>
          </div>
          <USelectMenu
            v-model="form.commandPermissions[group.key]"
            :items="roleOptions"
            value-key="value"
            multiple
            placeholder="Anyone with Discord permissions…"
            icon="i-lucide-users"
            class="w-full min-w-0 flex-1"
          />
        </div>
      </div>
      <UButton
        v-else
        variant="soft"
        color="neutral"
        size="xs"
        icon="i-lucide-rotate-cw"
        @click="loadRoles()"
      >
        Load roles
      </UButton>
    </DashboardModuleSection>

    <DashboardModuleSection
      title="Channel locking"
      description="How /lock behaves in this server."
    >
      <UFormField
        label="Lock-exempt roles"
        description="These roles can still send messages in channels locked with /lock."
        class="w-full"
      >
        <div v-if="rolesLoading" class="flex items-center gap-2 py-2 text-gray-400">
          <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
          <span class="text-sm">Loading roles…</span>
        </div>
        <USelectMenu
          v-else-if="roleOptions.length > 0"
          v-model="form.exemptRoleIds"
          :items="roleOptions"
          value-key="value"
          multiple
          placeholder="No exempt roles"
          icon="i-lucide-users"
          class="w-full"
        />
        <UButton
          v-else
          variant="soft"
          color="neutral"
          size="xs"
          icon="i-lucide-rotate-cw"
          @click="loadRoles()"
        >
          Load roles
        </UButton>
      </UFormField>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="moderation" />

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

const route = useRoute();
const guildId = route.params.guild_id as string;
const {
  state,
  isModuleEnabled,
  saveModuleSettings,
  getModuleConfig,
  loadChannels,
  loadRoles,
  channelOptions,
  roleOptions,
} = useServerSettings(guildId);

const channels = computed(() => state.value.channels);
const channelsLoading = computed(() => state.value.channelsLoading);
const rolesLoading = computed(() => state.value.rolesLoading);

const saving = ref(false);

// ── Form ──

interface ModerationForm {
  modLogChannelId: string;
  warnThreshold: number;
  warnAction: "timeout" | "kick" | "ban" | "none";
  autoTimeoutDuration: number;
  dmOnAction: boolean;
  exemptRoleIds: string[];
  // Not shown: the bot never reads it (legacy prefix-command setting). Kept in
  // the form so the stored value still round-trips through Save unchanged.
  deleteCommandMessage: boolean;
  commandPermissions: Record<string, string[]>;
}

const defaults = (): ModerationForm => ({
  modLogChannelId: "none",
  warnThreshold: 3,
  warnAction: "timeout",
  autoTimeoutDuration: 60,
  dmOnAction: true,
  exemptRoleIds: [],
  deleteCommandMessage: false,
  commandPermissions: {
    ban: [],
    kick: [],
    timeout: [],
    warn: [],
    purge: [],
    channel: [],
  },
});

const form = ref<ModerationForm>(defaults());
// Last loaded/saved values; drives the unsaved-changes bar and Discard.
const baseline = ref<ModerationForm>(defaults());
const snapshot = (): ModerationForm => JSON.parse(JSON.stringify(form.value));
const dirty = computed(
  () => JSON.stringify(form.value) !== JSON.stringify(baseline.value),
);

const commandPermissionGroups = [
  { key: "ban", label: "Ban & Unban", commands: "/ban, /unban" },
  { key: "kick", label: "Kick", commands: "/kick" },
  { key: "timeout", label: "Timeout", commands: "/timeout, /untimeout" },
  { key: "warn", label: "Warnings", commands: "/warn, /warnings, /clearwarnings" },
  { key: "purge", label: "Purge messages", commands: "/purge" },
  { key: "channel", label: "Channel management", commands: "/slowmode, /lock, /unlock" },
];

const warnActionOptions = [
  {
    value: "timeout",
    label: "Timeout",
    description: "Time the user out for a set duration.",
    icon: "i-lucide-clock",
    iconClass: "bg-sky-200/10 text-sky-200",
    checkClass: "text-teal-300",
    selectedClass:
      "peer-checked:bg-sky-200/[0.06] peer-checked:ring-2 peer-checked:ring-teal-300/60",
  },
  {
    value: "kick",
    label: "Kick",
    description: "Remove the user from the server.",
    icon: "i-lucide-log-out",
    iconClass: "bg-amber-400/10 text-amber-300",
    checkClass: "text-teal-300",
    selectedClass:
      "peer-checked:bg-sky-200/[0.06] peer-checked:ring-2 peer-checked:ring-teal-300/60",
  },
  {
    value: "ban",
    label: "Ban",
    description: "Permanently ban the user. The most aggressive option.",
    icon: "i-lucide-ban",
    iconClass: "bg-red-400/10 text-red-300",
    checkClass: "text-red-300",
    selectedClass:
      "peer-checked:bg-red-400/[0.06] peer-checked:ring-2 peer-checked:ring-red-400/60",
  },
  {
    value: "none",
    label: "Warn only",
    description: "Keep recording warnings, but take no automatic action.",
    icon: "i-lucide-eye",
    iconClass: "bg-white/[0.06] text-gray-300",
    checkClass: "text-teal-300",
    selectedClass:
      "peer-checked:bg-sky-200/[0.06] peer-checked:ring-2 peer-checked:ring-teal-300/60",
  },
];

const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) {
    return `${hours}h${mins > 0 ? ` ${mins}m` : ""}`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d${remHours > 0 ? ` ${remHours}h` : ""}`;
};

const warnSummary = computed(() => {
  const n = form.value.warnThreshold;
  const after = `After ${n} warning${n !== 1 ? "s" : ""}, `;
  switch (form.value.warnAction) {
    case "timeout":
      return `${after}the user is timed out for ${formatMinutes(form.value.autoTimeoutDuration)}.`;
    case "kick":
      return `${after}the user is kicked.`;
    case "ban":
      return `${after}the user is banned.`;
    default:
      return "Warnings are recorded, but no automatic action is taken.";
  }
});

// ── Save ──

const save = async () => {
  saving.value = true;
  const ok = await saveModuleSettings("moderation", {
    // Keep bot-owned keys (botCanViewAuditLog, lastCaseId, warnings) the form doesn't know about.
    ...getModuleConfig("moderation"),
    ...form.value,
    modLogChannelId:
      form.value.modLogChannelId === "none" ? "" : form.value.modLogChannelId,
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) baseline.value = snapshot();
  saving.value = false;
};

const discard = () => {
  form.value = JSON.parse(JSON.stringify(baseline.value));
};

// ── Init ──

onMounted(() => {
  loadChannels();
  loadRoles();

  const saved = getModuleConfig("moderation");
  if (saved && Object.keys(saved).length > 0) {
    const d = defaults();
    form.value = {
      modLogChannelId: saved.modLogChannelId || "none",
      warnThreshold: saved.warnThreshold ?? d.warnThreshold,
      warnAction: saved.warnAction ?? d.warnAction,
      autoTimeoutDuration: saved.autoTimeoutDuration ?? d.autoTimeoutDuration,
      dmOnAction: saved.dmOnAction ?? d.dmOnAction,
      exemptRoleIds: saved.exemptRoleIds ?? [],
      deleteCommandMessage: saved.deleteCommandMessage ?? d.deleteCommandMessage,
      commandPermissions: {
        ban: saved.commandPermissions?.ban ?? [],
        kick: saved.commandPermissions?.kick ?? [],
        timeout: saved.commandPermissions?.timeout ?? [],
        warn: saved.commandPermissions?.warn ?? [],
        purge: saved.commandPermissions?.purge ?? [],
        channel: saved.commandPermissions?.channel ?? [],
      },
    };
    baseline.value = snapshot();
  }
});
</script>
