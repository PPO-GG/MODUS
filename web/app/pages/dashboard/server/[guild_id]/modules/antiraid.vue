<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-shield-check"
      title="Anti-Raid Protection"
      description="Detect rapid join floods and respond automatically."
      :enabled="isModuleEnabled('antiraid')"
    />

    <DashboardModuleSection
      title="Detection"
      description="A raid is flagged when this many members join within the time window."
    >
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UFormField label="Join threshold" hint="Minimum 2" class="w-full">
          <UInput
            v-model.number="settings.joinThreshold"
            type="number"
            :min="2"
            placeholder="5"
            icon="i-lucide-user-plus"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Time window (seconds)" hint="1–300" class="w-full">
          <UInput
            v-model.number="settings.timeWindow"
            type="number"
            :min="1"
            :max="300"
            placeholder="10"
            icon="i-lucide-timer"
            class="w-full"
          />
        </UFormField>
      </div>
      <p
        v-if="settings.joinThreshold && settings.timeWindow"
        class="mt-4 flex items-center gap-2 rounded-lg bg-sky-200/[0.06] px-3 py-2 text-[13px] text-sky-200"
      >
        <UIcon name="i-lucide-info" class="h-4 w-4 shrink-0" />
        <span>
          Triggers when
          <strong class="font-semibold">{{ settings.joinThreshold }} members</strong>
          join within
          <strong class="font-semibold">{{ settings.timeWindow }} seconds</strong>.
        </span>
      </p>
    </DashboardModuleSection>

    <DashboardModuleSection
      title="Response"
      description="What Anti-Raid does the moment a raid is detected."
    >
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3" role="radiogroup" aria-label="Response action">
        <label v-for="opt in actionOptions" :key="opt.value" class="block cursor-pointer">
          <input
            v-model="settings.action"
            type="radio"
            name="antiraid-action"
            :value="opt.value"
            class="peer sr-only"
          />
          <div
            class="flex h-full flex-col gap-2 rounded-xl p-4 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
            :class="opt.selectedClass"
          >
            <div class="flex items-center justify-between">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-lg"
                :class="opt.iconClass"
              >
                <UIcon :name="opt.icon" class="h-4 w-4" />
              </span>
              <UIcon
                v-if="settings.action === opt.value"
                name="i-lucide-circle-check"
                class="h-5 w-5"
                :class="opt.checkClass"
              />
            </div>
            <span class="text-sm font-semibold text-white">{{ opt.label }}</span>
            <span class="text-[13px] leading-relaxed text-gray-400">
              {{ opt.description }}
              <template v-if="opt.value === 'lockdown'">
                Use <code class="text-sky-200">/antiraid unlock</code> to restore.
              </template>
            </span>
          </div>
        </label>
      </div>
    </DashboardModuleSection>

    <DashboardModuleSection
      title="Alerts"
      description="Post a message when a raid is detected. Optional."
    >
      <UFormField label="Alert channel" class="w-full">
        <div v-if="state.channelsLoading" class="flex items-center gap-2 py-2 text-gray-400">
          <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
          <span class="text-sm">Loading channels…</span>
        </div>
        <USelectMenu
          v-else-if="channelOptions.length > 0"
          v-model="settings.alertChannelId"
          :items="channelOptions"
          value-key="value"
          placeholder="No alerts"
          searchable
          icon="i-lucide-hash"
          class="w-full"
        />
        <p v-else class="py-2 text-sm italic text-gray-500">No channels available.</p>
      </UFormField>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="antiraid" />

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

interface AntiRaidSettingsForm {
  joinThreshold: number;
  timeWindow: number;
  action: string;
  alertChannelId: string;
}

const defaults: AntiRaidSettingsForm = {
  joinThreshold: 5,
  timeWindow: 10,
  action: "lockdown",
  alertChannelId: "",
};

const settings = ref<AntiRaidSettingsForm>({ ...defaults });
// Last loaded/saved values; drives the unsaved-changes bar and Discard.
const baseline = ref<AntiRaidSettingsForm>({ ...defaults });
const dirty = computed(
  () => JSON.stringify(settings.value) !== JSON.stringify(baseline.value),
);

const actionOptions = [
  {
    value: "lockdown",
    label: "Lockdown",
    description: "Revokes Send Messages for @everyone in all text channels.",
    icon: "i-lucide-lock",
    iconClass: "bg-sky-200/10 text-sky-200",
    checkClass: "text-teal-300",
    selectedClass:
      "peer-checked:bg-sky-200/[0.06] peer-checked:ring-2 peer-checked:ring-teal-300/60",
  },
  {
    value: "kick",
    label: "Kick raiders",
    description: "Kicks recent joins that have no roles besides @everyone.",
    icon: "i-lucide-log-out",
    iconClass: "bg-amber-400/10 text-amber-300",
    checkClass: "text-teal-300",
    selectedClass:
      "peer-checked:bg-sky-200/[0.06] peer-checked:ring-2 peer-checked:ring-teal-300/60",
  },
  {
    value: "ban",
    label: "Ban raiders",
    description:
      "Bans recent joins that have no roles besides @everyone. The most aggressive option.",
    icon: "i-lucide-ban",
    iconClass: "bg-red-400/10 text-red-300",
    checkClass: "text-red-300",
    selectedClass:
      "peer-checked:bg-red-400/[0.06] peer-checked:ring-2 peer-checked:ring-red-400/60",
  },
];

// ── Save ──

const save = async () => {
  saving.value = true;
  const ok = await saveModuleSettings("antiraid", {
    joinThreshold: settings.value.joinThreshold,
    timeWindow: settings.value.timeWindow,
    action: settings.value.action,
    alertChannelId: settings.value.alertChannelId || undefined,
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
  const saved = getModuleConfig("antiraid");
  if (saved && Object.keys(saved).length > 0) {
    settings.value = {
      joinThreshold: saved.joinThreshold ?? defaults.joinThreshold,
      timeWindow: saved.timeWindow ?? defaults.timeWindow,
      action: saved.action ?? defaults.action,
      alertChannelId: saved.alertChannelId ?? "",
    };
    baseline.value = { ...settings.value };
  }
  await loadChannels();
});
</script>
