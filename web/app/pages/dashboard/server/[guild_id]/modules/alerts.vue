<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-bell-ring"
      title="Social Alerts"
      description="Post to a channel when a creator, feed or repo has something new."
      :enabled="isModuleEnabled('alerts')"
    />

    <!-- ── Add alert ── -->
    <DashboardModuleSection
      title="Add alert"
      description="Pick a source, say where to post it, then save."
    >
      <div class="space-y-5">
        <div>
          <span class="mb-2 block text-sm font-medium text-white">Platform</span>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Platform">
            <label v-for="p in platforms" :key="p.value" class="block cursor-pointer">
              <input
                v-model="newAlert.platform"
                type="radio"
                name="alert-platform"
                :value="p.value"
                class="peer sr-only"
              />
              <div
                class="flex h-full items-start gap-3 rounded-xl p-3.5 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-checked:bg-sky-200/[0.06] peer-checked:ring-2 peer-checked:ring-teal-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
              >
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  :class="p.tileClass"
                >
                  <UIcon :name="p.icon" class="h-4 w-4" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-white">{{ p.label }}</span>
                  <span class="block text-[13px] leading-relaxed text-gray-400">
                    {{ p.description }}
                  </span>
                </span>
                <UIcon
                  v-if="newAlert.platform === p.value"
                  name="i-lucide-circle-check"
                  class="h-5 w-5 shrink-0 text-teal-300"
                />
              </div>
            </label>
          </div>
        </div>

        <UFormField :label="platform.handleLabel" :hint="platform.hint" class="w-full">
          <UInput
            v-model="newAlert.handle"
            :placeholder="platform.placeholder"
            :icon="platform.icon"
            class="w-full"
            @keydown.enter="addAlert"
          />
        </UFormField>
        <p
          v-if="handleLooksWrong"
          class="flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
        >
          <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
          {{ platform.formatWarning }}
        </p>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Post in channel" class="w-full">
            <div v-if="state.channelsLoading" class="flex items-center gap-2 py-2 text-gray-400">
              <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
              <span class="text-sm">Loading channels…</span>
            </div>
            <USelectMenu
              v-else-if="channelOptions.length > 0"
              v-model="newAlert.channelId"
              :items="channelOptions"
              value-key="value"
              placeholder="Select a channel"
              searchable
              icon="i-lucide-hash"
              class="w-full"
            />
            <p v-else class="py-2 text-sm italic text-gray-500">No channels available.</p>
          </UFormField>
          <UFormField label="Custom message" hint="Optional" class="w-full">
            <UInput
              v-model="newAlert.message"
              placeholder="e.g. Hey @everyone, new video!"
              class="w-full"
              @keydown.enter="addAlert"
            />
          </UFormField>
        </div>

        <p
          v-if="existingAlert"
          class="flex items-center gap-2 rounded-lg bg-sky-200/[0.06] px-3 py-2 text-[13px] text-sky-200"
        >
          <UIcon name="i-lucide-info" class="h-4 w-4 shrink-0" />
          This source is already added. Adding it again updates its channel and message.
        </p>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="flex items-center gap-2 text-[13px] text-gray-400">
            <UIcon name="i-lucide-clock" class="h-4 w-4 shrink-0" />
            {{ platform.timing }}
          </p>
          <UButton
            color="primary"
            icon="i-lucide-plus"
            :disabled="!newAlert.handle.trim() || !newAlert.channelId"
            @click="addAlert"
          >
            {{ existingAlert ? "Update alert" : "Add alert" }}
          </UButton>
        </div>

        <p class="border-t border-white/[0.06] pt-4 text-[13px] text-gray-400">
          Need more than releases or stream alerts, like PRs, issues or events from another service?
          Use
          <NuxtLink
            :to="`/dashboard/server/${guildId}/modules/triggers`"
            class="text-sky-200 underline underline-offset-2 hover:text-teal-300"
          >
            Webhooks
          </NuxtLink>
          instead.
        </p>
      </div>
    </DashboardModuleSection>

    <!-- ── Active alerts ── -->
    <DashboardModuleSection
      title="Alerts"
      :description="`${settings.alerts.length} alert${settings.alerts.length !== 1 ? 's' : ''} configured.`"
    >
      <div
        v-if="settings.alerts.length === 0"
        class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
        >
          <UIcon name="i-lucide-bell-ring" class="h-5 w-5 text-sky-200" />
        </span>
        <div>
          <h4 class="text-sm font-semibold text-white">No alerts yet</h4>
          <p class="mt-1 text-[13px] text-gray-400">Add a source above to get started.</p>
        </div>
      </div>

      <ul v-else class="-mx-2 divide-y divide-white/[0.06]">
        <li
          v-for="(alert, index) in settings.alerts"
          :key="`${alert.platform}-${alert.handle.toLowerCase()}`"
          class="flex items-center gap-3 px-2 py-3"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            :class="platformMeta(alert.platform)?.tileClass ?? 'bg-white/[0.06] text-gray-300'"
          >
            <UIcon :name="platformMeta(alert.platform)?.icon ?? 'i-lucide-bell'" class="h-4 w-4" />
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p class="min-w-0 truncate text-sm font-medium text-white">{{ alert.handle }}</p>
              <span
                class="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-gray-300"
              >
                {{ platformMeta(alert.platform)?.label ?? alert.platform }}
              </span>
              <span
                v-if="!platformMeta(alert.platform)"
                class="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300"
                title="The alerts worker doesn't check this platform, so nothing will be posted."
              >
                <UIcon name="i-lucide-triangle-alert" class="h-3 w-3" />
                Not supported
              </span>
            </div>
            <p class="mt-0.5 truncate text-[13px] text-gray-400">
              → {{ getChannelName(alert.channelId) }}
              <span v-if="alert.message"> · {{ alert.message }}</span>
            </p>
          </div>

          <UButton
            color="error"
            variant="ghost"
            size="sm"
            icon="i-lucide-trash-2"
            :aria-label="`Remove ${alert.handle}`"
            @click="removeAlert(index)"
          />
        </li>
      </ul>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="alerts" />

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";

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

// ── Types ──

interface SocialAlert {
  platform: string;
  handle: string;
  channelId: string;
  message?: string;
}

interface AlertsSettingsForm {
  alerts: SocialAlert[];
}

const settings = ref<AlertsSettingsForm>({
  alerts: [],
});

// Last loaded/saved values (JSON); drives the unsaved-changes bar and Discard.
const baseline = ref(JSON.stringify(settings.value));
const dirty = computed(() => JSON.stringify(settings.value) !== baseline.value);

// ── Platforms ──
// Only these are handled by the bot's AlertsWorker. The schema also allows
// "x" and "tiktok", which the worker skips, so they aren't offered here.

const POLL_NOTE = "Checked every 10 minutes.";

const platforms = [
  {
    value: "youtube",
    label: "YouTube",
    icon: "i-simple-icons-youtube",
    tileClass: "bg-red-400/10 text-red-300",
    description: "New video uploads.",
    handleLabel: "Channel ID",
    hint: "Starts with UC",
    placeholder: "UCxxxxxxxxxxxxxxxxxxxxxx",
    pattern: /^UC[\w-]{22}$/,
    formatWarning:
      "This doesn't look like a YouTube channel ID. It starts with UC (find it in youtube.com/channel/UC…).",
    timing: POLL_NOTE,
  },
  {
    value: "twitch",
    label: "Twitch",
    icon: "i-simple-icons-twitch",
    tileClass: "bg-violet-400/10 text-violet-300",
    description: "Stream going online or offline.",
    handleLabel: "Login name",
    hint: "e.g. shroud",
    placeholder: "shroud",
    pattern: /^[A-Za-z0-9_]{3,25}$/,
    formatWarning:
      "This doesn't look like a Twitch login name. Use the name from the channel URL, letters, numbers and underscores only.",
    timing: "Delivered in real time.",
  },
  {
    value: "rss",
    label: "RSS feed",
    icon: "i-lucide-rss",
    tileClass: "bg-orange-400/10 text-orange-300",
    description: "Any RSS 2.0 or Atom feed.",
    handleLabel: "Feed URL",
    hint: "Full URL",
    placeholder: "https://example.com/feed.xml",
    pattern: /^https?:\/\/\S+$/i,
    formatWarning: "This doesn't look like a feed URL. Enter the full address, starting with https://.",
    timing: POLL_NOTE,
  },
  {
    value: "github",
    label: "GitHub",
    icon: "i-simple-icons-github",
    tileClass: "bg-white/[0.08] text-gray-200",
    description: "New repository releases.",
    handleLabel: "Repository",
    hint: "owner/repo",
    placeholder: "discord/discord-api-docs",
    pattern: /^[\w.-]+\/[\w.-]+$/,
    formatWarning: "This doesn't look like a repository. Use the form owner/repo.",
    timing: POLL_NOTE,
  },
];

const platformMeta = (value: string) => platforms.find((p) => p.value === value);

const newAlert = reactive({
  platform: "youtube",
  handle: "",
  channelId: "",
  message: "",
});

const platform = computed(() => platformMeta(newAlert.platform)!);

const handleLooksWrong = computed(() => {
  const h = newAlert.handle.trim();
  return !!h && !platform.value.pattern.test(h);
});

// The bot treats the same platform + handle (case-insensitive) as one alert
// and updates it on re-add, so the dashboard does the same.
const findAlertIndex = (platformValue: string, handle: string) =>
  settings.value.alerts.findIndex(
    (a) => a.platform === platformValue && a.handle.toLowerCase() === handle.toLowerCase(),
  );

const existingAlert = computed(() => {
  const h = newAlert.handle.trim();
  return !!h && findAlertIndex(newAlert.platform, h) > -1;
});

const addAlert = () => {
  const handle = newAlert.handle.trim();
  if (!handle || !newAlert.channelId) return;
  const alert: SocialAlert = {
    platform: newAlert.platform,
    handle,
    channelId: newAlert.channelId,
    message: newAlert.message.trim() || undefined,
  };
  const idx = findAlertIndex(alert.platform, handle);
  if (idx > -1) {
    // Keep the stored spelling: the match is case-insensitive, but some
    // handles (YouTube channel IDs, feed URLs) are case-sensitive.
    settings.value.alerts[idx] = { ...alert, handle: settings.value.alerts[idx]!.handle };
  } else {
    settings.value.alerts.push(alert);
  }
  newAlert.handle = "";
  newAlert.channelId = "";
  newAlert.message = "";
};

const removeAlert = (index: number) => {
  settings.value.alerts.splice(index, 1);
};

// ── Helpers ──

function getChannelName(channelId: string): string {
  const ch = state.value.channels.find((c: any) => c.id === channelId);
  return ch ? `#${ch.name}` : `#${channelId}`;
}

// ── Save ──

const save = async () => {
  saving.value = true;
  const ok = await saveModuleSettings("alerts", {
    ...getModuleConfig("alerts"),
    alerts: settings.value.alerts,
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) baseline.value = JSON.stringify(settings.value);
  saving.value = false;
};

const discard = () => {
  settings.value = JSON.parse(baseline.value);
};

// ── Init ──

onMounted(async () => {
  const saved = getModuleConfig("alerts");
  if (saved && Object.keys(saved).length > 0) {
    settings.value = {
      alerts: Array.isArray(saved.alerts) ? saved.alerts : [],
    };
  }
  baseline.value = JSON.stringify(settings.value);
  await loadChannels();
});
</script>
