<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-clipboard-list"
      title="Audit Logging"
      description="Track server events and post them to a dedicated channel."
      :enabled="isModuleEnabled('logging')"
    />

    <DashboardModuleSection
      title="Destination"
      description="Every enabled event below is posted to this channel."
    >
      <UFormField label="Audit channel" class="w-full">
        <div v-if="state.channelsLoading" class="flex items-center gap-2 py-2 text-gray-400">
          <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
          <span class="text-sm">Loading channels…</span>
        </div>
        <USelectMenu
          v-else-if="channelOptions.length > 0"
          v-model="settings.auditChannelId"
          :items="channelOptions"
          value-key="value"
          placeholder="Select a channel for audit logs…"
          searchable
          icon="i-lucide-hash"
          class="w-full"
        />
        <p v-else class="py-2 text-sm italic text-gray-500">
          No channels available. Make sure the bot is in this server.
        </p>
      </UFormField>

      <p
        v-if="!state.channelsLoading && !settings.auditChannelId"
        class="mt-4 flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
      >
        <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
        No channel selected. Nothing will be logged until you pick one.
      </p>
      <p
        v-else-if="settings.auditChannelId"
        class="mt-4 flex items-center gap-2 rounded-lg bg-sky-200/[0.06] px-3 py-2 text-[13px] text-sky-200"
      >
        <UIcon name="i-lucide-info" class="h-4 w-4 shrink-0" />
        <span>
          Posting to
          <strong class="font-semibold">{{ getChannelName(settings.auditChannelId) }}</strong>.
        </span>
      </p>
    </DashboardModuleSection>

    <DashboardModuleSection
      title="Events"
      :description="`${enabledCount} of ${eventToggles.length} event categories enabled.`"
    >
      <template #actions>
        <UButton size="xs" color="neutral" variant="ghost" @click="setAll(!allEnabled)">
          {{ allEnabled ? "Disable all" : "Enable all" }}
        </UButton>
      </template>

      <div class="-mx-2 space-y-1">
        <label
          v-for="toggle in eventToggles"
          :key="toggle.key"
          class="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-200/10 text-sky-200"
          >
            <UIcon :name="toggle.icon" class="h-4 w-4" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-white">{{ toggle.label }}</span>
            <span class="block text-[13px] text-gray-400">{{ toggle.description }}</span>
          </span>
          <USwitch v-model="settings[toggle.key]" :aria-label="toggle.label" />
        </label>
      </div>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="logging" />

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";

const route = useRoute();
const guildId = route.params.guild_id as string;
const {
  state,
  isModuleEnabled,
  saveModuleSettings,
  getModuleConfig,
  loadChannels,
  channelOptions,
} = useServerSettings(guildId);

const saving = ref(false);

// ── Settings ──

type BooleanToggleKey =
  | "logMessages"
  | "logMembers"
  | "logRoles"
  | "logChannels"
  | "logInvites";

interface LoggingSettingsForm {
  auditChannelId: string;
  logMessages: boolean;
  logMembers: boolean;
  logRoles: boolean;
  logChannels: boolean;
  logInvites: boolean;
}

const defaults: LoggingSettingsForm = {
  auditChannelId: "",
  logMessages: false,
  logMembers: false,
  logRoles: false,
  logChannels: false,
  logInvites: false,
};

const settings = ref<LoggingSettingsForm>({ ...defaults });
// Last loaded/saved values; drives the unsaved-changes bar and Discard.
const baseline = ref<LoggingSettingsForm>({ ...defaults });
const dirty = computed(
  () => JSON.stringify(settings.value) !== JSON.stringify(baseline.value),
);

// ── Toggle definitions ──

const eventToggles: {
  key: BooleanToggleKey;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    key: "logMessages",
    label: "Message events",
    description:
      "Deleted messages (with content and attachments) and edits (before/after)",
    icon: "i-lucide-message-square",
  },
  {
    key: "logMembers",
    label: "Member events",
    description: "Joins and leaves, with account age and join date",
    icon: "i-lucide-users",
  },
  {
    key: "logRoles",
    label: "Role events",
    description: "Role creation, updates (name and color) and deletion",
    icon: "i-lucide-shield",
  },
  {
    key: "logChannels",
    label: "Channel events",
    description: "Channel creation and deletion",
    icon: "i-lucide-folder",
  },
  {
    key: "logInvites",
    label: "Invite events",
    description: "Invite link creation and deletion, with creator info",
    icon: "i-lucide-link",
  },
];

const enabledCount = computed(
  () => eventToggles.filter((t) => settings.value[t.key]).length,
);
const allEnabled = computed(() => enabledCount.value === eventToggles.length);

const setAll = (value: boolean) => {
  for (const t of eventToggles) settings.value[t.key] = value;
};

// ── Helpers ──

function getChannelName(channelId: string): string {
  const ch = state.value.channels.find((c: any) => c.id === channelId);
  return ch ? `#${ch.name}` : channelId;
}

// ── Save ──

const save = async () => {
  saving.value = true;
  const ok = await saveModuleSettings("logging", {
    auditChannelId: settings.value.auditChannelId,
    logMessages: settings.value.logMessages,
    logMembers: settings.value.logMembers,
    logRoles: settings.value.logRoles,
    logChannels: settings.value.logChannels,
    logInvites: settings.value.logInvites,
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) baseline.value = { ...settings.value };
  saving.value = false;
};

const discard = () => {
  settings.value = { ...baseline.value };
};

// ── Init ──

onMounted(async () => {
  // Load saved settings
  const saved = getModuleConfig("logging");
  if (saved && Object.keys(saved).length > 0) {
    settings.value = {
      auditChannelId: saved.auditChannelId ?? "",
      logMessages: saved.logMessages ?? false,
      logMembers: saved.logMembers ?? false,
      logRoles: saved.logRoles ?? false,
      logChannels: saved.logChannels ?? false,
      logInvites: saved.logInvites ?? false,
    };
    baseline.value = { ...settings.value };
  }

  // Load channels for the channel selector
  await loadChannels();
});
</script>
