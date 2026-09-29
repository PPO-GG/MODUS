<template>
  <div
    :class="
      activeTab === 'card'
        ? 'flex h-full flex-col gap-4 p-4 md:p-6'
        : 'mx-auto max-w-3xl space-y-6'
    "
  >
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-trophy"
      title="XP & Leveling"
      description="How members earn XP, how levels are announced, and their rank cards."
      :enabled="isModuleEnabled('xp')"
    />

    <!-- ── Tabs ── -->
    <div
      class="inline-flex self-start rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-white/10"
      role="tablist"
      aria-label="XP sections"
    >
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab.value"
        class="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
        :class="
          activeTab === tab.value
            ? 'bg-sky-200/15 text-white ring-1 ring-inset ring-sky-100/25'
            : 'text-gray-400 hover:text-white'
        "
        @click="activeTab = tab.value"
      >
        <UIcon :name="tab.icon" class="h-4 w-4" />
        {{ tab.label }}
      </button>
    </div>

    <!-- ── General ── -->
    <template v-if="activeTab === 'general'">
      <!-- XP earning -->
      <DashboardModuleSection
        title="XP earning"
        description="How members gain XP from chat messages."
      >
        <div class="space-y-5">
          <div>
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <span class="text-sm font-medium text-white">XP per message</span>
              <span class="text-sm text-sky-200">
                {{ settings.minXpPerMessage }} to {{ settings.maxXpPerMessage }} XP,
                about {{ avgXp }} on average
              </span>
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField label="Minimum" class="w-full">
                <UInput
                  v-model.number="settings.minXpPerMessage"
                  type="number"
                  :min="1"
                  :max="settings.maxXpPerMessage"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Maximum" class="w-full">
                <UInput
                  v-model.number="settings.maxXpPerMessage"
                  type="number"
                  :min="settings.minXpPerMessage"
                  :max="500"
                  class="w-full"
                />
              </UFormField>
            </div>
            <p
              v-if="settings.minXpPerMessage > settings.maxXpPerMessage"
              class="mt-3 flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
            >
              <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
              The minimum is higher than the maximum.
            </p>
            <p class="mt-2 text-[13px] text-gray-400">
              Each message awards a random amount between the two.
            </p>
          </div>

          <div class="border-t border-white/[0.06] pt-5">
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <label class="text-sm font-medium text-white" for="xp-cooldown">Message cooldown</label>
              <span class="text-sm text-sky-200">{{ formatCooldown(settings.cooldownSeconds) }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="preset in cooldownPresets"
                :key="preset"
                type="button"
                class="rounded-full px-3 py-1.5 text-xs ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
                :class="
                  settings.cooldownSeconds === preset
                    ? 'bg-sky-200/[0.06] text-white ring-2 ring-teal-300/60'
                    : 'text-gray-300 ring-white/10 hover:bg-white/[0.04]'
                "
                @click="settings.cooldownSeconds = preset"
              >
                {{ preset >= 60 ? `${preset / 60} min` : `${preset}s` }}
              </button>
              <UInput
                id="xp-cooldown"
                v-model.number="settings.cooldownSeconds"
                type="number"
                :min="5"
                :max="3600"
                size="sm"
                class="w-24"
                aria-label="Cooldown in seconds"
              />
              <span class="text-xs text-gray-400">seconds</span>
            </div>
            <p class="mt-2 text-[13px] text-gray-400">
              XP is granted once per cooldown per member, which stops spam farming.
            </p>
          </div>

          <div class="border-t border-white/[0.06] pt-5">
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <label class="text-sm font-medium text-white" for="xp-minlen">Minimum message length</label>
              <span class="text-sm text-sky-200">{{ settings.minMessageLength }} characters</span>
            </div>
            <UInput
              id="xp-minlen"
              v-model.number="settings.minMessageLength"
              type="number"
              :min="1"
              :max="100"
              icon="i-lucide-message-square"
              class="w-full sm:w-48"
            />
            <p class="mt-2 text-[13px] text-gray-400">
              Shorter messages, like a single emoji or "k", don't earn XP.
            </p>
          </div>
        </div>
      </DashboardModuleSection>

      <!-- Progression -->
      <DashboardModuleSection
        title="Progression"
        description="What the rates above mean in practice. Pick a level to see its cost."
      >
        <div class="space-y-4">
          <div class="flex items-center gap-3">
            <USlider v-model="calcLevel" :min="1" :max="100" :step="1" class="flex-1" />
            <span class="w-16 shrink-0 text-right font-mono text-sm text-sky-200">Lv. {{ calcLevel }}</span>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div class="rounded-lg bg-white/[0.04] p-3">
              <div class="text-xs text-gray-400">Total XP to reach level {{ calcLevel }}</div>
              <div class="mt-0.5 font-mono text-lg font-semibold text-white">
                {{ simulatedLevelStats.totalXp.toLocaleString() }}
              </div>
            </div>
            <div class="rounded-lg bg-white/[0.04] p-3">
              <div class="text-xs text-gray-400">XP for level {{ calcLevel + 1 }}</div>
              <div class="mt-0.5 font-mono text-lg font-semibold text-sky-200">
                {{ simulatedLevelStats.xpForNext.toLocaleString() }}
              </div>
            </div>
            <div class="rounded-lg bg-white/[0.04] p-3">
              <div class="text-xs text-gray-400">Messages to get there</div>
              <div class="mt-0.5 font-mono text-lg font-semibold text-teal-300">
                ~{{ simulatedLevelStats.estimatedMessages.toLocaleString() }}
              </div>
            </div>
          </div>
          <p class="text-[13px] text-gray-400">
            Each level costs <code class="font-mono text-gray-300">5 × L² + 50 × L + 100</code> XP.
          </p>
        </div>
      </DashboardModuleSection>

      <!-- Level-up announcements -->
      <DashboardModuleSection
        title="Level-up announcements"
        description="Where and how the bot celebrates a level-up."
      >
        <div class="space-y-5">
          <UFormField
            label="Announcement channel"
            hint="Optional"
            description="Leave empty to announce in the channel where the member levelled up."
            class="w-full"
          >
            <USelectMenu
              v-model="settings.announcementChannel"
              :items="channelItems"
              value-key="value"
              placeholder="Same channel as the level-up"
              searchable
              icon="i-lucide-hash"
              :loading="state.channelsLoading"
              :clear="{ ariaLabel: 'Clear channel selection' }"
              class="w-full"
            />
          </UFormField>

          <div>
            <UFormField label="Celebration message" class="w-full">
              <UInput
                v-model="settings.levelUpMessage"
                placeholder="Congratulations {user}, you reached level {level}!"
                class="w-full"
              />
            </UFormField>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <span class="text-[13px] text-gray-400">Insert:</span>
              <button
                v-for="tag in messageTags"
                :key="tag"
                type="button"
                class="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[12px] text-sky-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-sky-200/10 hover:ring-sky-200/30 focus-visible:outline-2 focus-visible:outline-teal-300"
                @click="insertVariable(tag)"
              >
                {{ tag }}
              </button>
            </div>
          </div>

          <div>
            <span class="mb-2 block text-sm font-medium text-white">Preview</span>
            <div class="flex items-start gap-3 rounded-xl bg-[#313338] p-4">
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-sky-600 to-teal-500"
              >
                <UIcon name="i-lucide-bot" class="h-5 w-5 text-white" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-semibold text-white">MODUS</span>
                  <span class="rounded bg-[#5865F2] px-1.5 text-[10px] font-semibold leading-4 text-white">BOT</span>
                  <span class="text-[11px] text-[#949ba4]">Today at 4:20 PM</span>
                </div>
                <p class="mt-0.5 break-words text-sm text-[#dbdee1]">{{ previewRenderedMessage }}</p>
              </div>
            </div>
          </div>
        </div>
      </DashboardModuleSection>

      <!-- Exclusions -->
      <DashboardModuleSection
        title="Exclusions"
        description="Messages in these channels, or from members with these roles, never earn XP."
      >
        <div class="space-y-5">
          <UFormField label="Excluded channels" class="w-full">
            <div v-if="state.channelsLoading" class="flex items-center gap-2 py-2 text-gray-400">
              <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
              <span class="text-sm">Loading channels…</span>
            </div>
            <USelectMenu
              v-else
              v-model="settings.excludedChannelIds"
              :items="excludableChannels"
              value-key="value"
              multiple
              searchable
              placeholder="No excluded channels"
              icon="i-lucide-hash"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Excluded roles" class="w-full">
            <div v-if="state.rolesLoading" class="flex items-center gap-2 py-2 text-gray-400">
              <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
              <span class="text-sm">Loading roles…</span>
            </div>
            <USelectMenu
              v-else
              v-model="settings.excludedRoleIds"
              :items="roleOptions"
              value-key="value"
              multiple
              searchable
              placeholder="No excluded roles"
              icon="i-lucide-users"
              class="w-full"
            />
          </UFormField>
        </div>
      </DashboardModuleSection>

      <!-- Leaderboard -->
      <DashboardModuleSection
        title="Leaderboard visibility"
        description="Who can see this server's leaderboard on the web."
      >
        <template #actions>
          <UButton
            :to="`/xp/${guildId}`"
            target="_blank"
            color="neutral"
            variant="soft"
            size="sm"
            trailing-icon="i-lucide-external-link"
          >
            Open leaderboard
          </UButton>
        </template>

        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3" role="radiogroup" aria-label="Leaderboard visibility">
            <label v-for="opt in visibilityOptions" :key="opt.value" class="block cursor-pointer">
              <input
                v-model="settings.leaderboardVisibility"
                type="radio"
                name="xp-visibility"
                :value="opt.value"
                class="peer sr-only"
              />
              <div
                class="flex h-full flex-col gap-2 rounded-xl p-3.5 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-checked:bg-sky-200/[0.06] peer-checked:ring-2 peer-checked:ring-teal-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="flex items-center gap-2 text-sm font-semibold text-white">
                    <span
                      class="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-200/10 text-sky-200"
                    >
                      <UIcon :name="opt.icon" class="h-4 w-4" />
                    </span>
                    {{ opt.label }}
                  </span>
                  <UIcon
                    v-if="settings.leaderboardVisibility === opt.value"
                    name="i-lucide-circle-check"
                    class="h-5 w-5 text-teal-300"
                  />
                </div>
                <p class="text-[13px] leading-relaxed text-gray-400">{{ opt.description }}</p>
                <p class="mt-auto pt-1 text-xs text-gray-500">{{ opt.footnote }}</p>
              </div>
            </label>
          </div>

          <p
            class="flex items-start gap-2 rounded-lg bg-sky-200/[0.06] px-3 py-2 text-[13px] text-sky-200"
          >
            <UIcon name="i-lucide-info" class="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Members can also hide their own profile from the web leaderboard with
              <code class="font-mono">/xp privacy hidden:true</code>.
            </span>
          </p>
        </div>
      </DashboardModuleSection>

      <div class="flex justify-start">
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-rotate-cw" @click="resetToDefaults">
          Reset to recommended defaults
        </UButton>
      </div>

      <DashboardModuleAccessSection :guild-id="guildId" module-name="xp" />
    </template>

    <!-- ── Rank card designer ── -->
    <CanvasEditor
      v-else
      :key="editorKey"
      :model-value="settings.cardTemplate"
      :guild-id="guildId"
      :profile="rankCardProfile"
      class="min-h-0 flex-1"
    />

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save()" @discard="discard" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import CanvasEditor from "~/components/CanvasEditor.vue";
import { rankCardProfile } from "~/utils/canvas-editor/profiles/rank-card";
import { MAX_IMAGE_LAYERS, imageLayerCount } from "~/utils/canvas-editor/elements";
import {
  DEFAULT_RANK_CARD_TEMPLATE,
  getCumulativeXpForLevel,
  type RankCardTemplate,
} from "~/utils/rank-cards";

const route = useRoute();
const toast = useToast();
const guildId = route.params.guild_id as string;
const {
  state,
  isModuleEnabled,
  saveModuleSettings,
  getModuleConfig,
  loadChannels,
  loadRoles,
  roleOptions,
} = useServerSettings(guildId);
const { setFullBleed, reset: resetPageChrome } = usePageChrome();

const tabs = [
  { value: "general", label: "General", icon: "i-lucide-sliders-horizontal" },
  { value: "card", label: "Rank card", icon: "i-lucide-palette" },
] as const;

const activeTab = ref<"general" | "card">("general");

watch(activeTab, (tab) => {
  if (tab === "card") {
    setFullBleed(true);
  } else {
    resetPageChrome();
  }
});
const saving = ref(false);
// Bumped on Discard so the card designer reloads the restored template.
const editorKey = ref(0);
const calcLevel = ref(10);

// ── Settings ──

const DEFAULT_LEVEL_UP_MESSAGE = "🎉 Congratulations {user}, you leveled up to **Level {level}**!";

const defaults = () => ({
  cooldownSeconds: 60,
  minXpPerMessage: 15,
  maxXpPerMessage: 25,
  minMessageLength: 5,
  announcementChannel: "" as string | null,
  levelUpMessage: DEFAULT_LEVEL_UP_MESSAGE,
  leaderboardVisibility: "private" as "private" | "unlisted" | "public",
  cardTemplate: JSON.parse(JSON.stringify(DEFAULT_RANK_CARD_TEMPLATE)) as RankCardTemplate,
  excludedChannelIds: [] as string[],
  excludedRoleIds: [] as string[],
});

const settings = ref(defaults());

// Last loaded/saved values (JSON); drives the unsaved-changes bar and Discard.
// A cleared channel select can come back as null, so normalise it.
const snapshot = () =>
  JSON.stringify({ ...settings.value, announcementChannel: settings.value.announcementChannel || "" });
const baseline = ref(snapshot());
const dirty = computed(() => snapshot() !== baseline.value);

// ── Options ──

const cooldownPresets = [30, 60, 120, 300];
const messageTags = ["{user}", "{username}", "{level}", "{server}"];

const visibilityOptions = [
  {
    value: "private",
    label: "Private",
    icon: "i-lucide-lock",
    description:
      "Ranks are only visible in Discord through /rank and /xp. The web page is restricted and never indexed.",
    footnote: "Default. Highest privacy.",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    icon: "i-lucide-link",
    description:
      "Anyone with your direct leaderboard link can view it. It's noindexed and left out of the directory.",
    footnote: "Direct URL only.",
  },
  {
    value: "public",
    label: "Public",
    icon: "i-lucide-globe",
    description:
      "Discoverable by search engines and listed in the global server leaderboards directory.",
    footnote: "Search and directory listed.",
  },
] as const;

// Every channel except categories, which can't hold messages.
const CATEGORY_CHANNEL = 4;
const channelItems = computed(() =>
  state.value.channels.map((c: any) => ({ label: `#${c.name}`, value: c.id })),
);
const excludableChannels = computed(() =>
  state.value.channels
    .filter((c: any) => c.type !== CATEGORY_CHANNEL)
    .map((c: any) => ({ label: `#${c.name}`, value: c.id })),
);

// ── Helpers ──

const avgXp = computed(() =>
  Math.round((settings.value.minXpPerMessage + settings.value.maxXpPerMessage) / 2),
);

const formatCooldown = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  return remSec > 0 ? `${mins}m ${remSec}s` : `${mins} minute${mins > 1 ? "s" : ""}`;
};

const insertVariable = (variable: string) => {
  if (!settings.value.levelUpMessage.includes(variable)) {
    settings.value.levelUpMessage = `${settings.value.levelUpMessage.trim()} ${variable}`;
  }
};

const previewRenderedMessage = computed(() => {
  const tpl = settings.value.levelUpMessage || "🎉 Congratulations {user}, you reached Level {level}!";
  return tpl
    .replace(/\{user\}/g, "@Alex")
    .replace(/\{username\}/g, "alex_dev")
    .replace(/\{level\}/g, "15")
    .replace(/\{server\}/g, state.value.guild?.name || "MODUS Community");
});

const simulatedLevelStats = computed(() => {
  const lvl = Math.max(1, calcLevel.value);
  const totalXp = getCumulativeXpForLevel(lvl);
  const xpForNext = 5 * lvl * lvl + 50 * lvl + 100;
  const avgXpPerMsg = Math.max(1, (settings.value.minXpPerMessage + settings.value.maxXpPerMessage) / 2);
  const estimatedMessages = Math.ceil(totalXp / avgXpPerMsg);

  return {
    totalXp,
    xpForNext,
    estimatedMessages,
  };
});

const resetToDefaults = () => {
  const d = defaults();
  settings.value.cooldownSeconds = d.cooldownSeconds;
  settings.value.minXpPerMessage = d.minXpPerMessage;
  settings.value.maxXpPerMessage = d.maxXpPerMessage;
  settings.value.minMessageLength = d.minMessageLength;
  settings.value.levelUpMessage = d.levelUpMessage;
  settings.value.leaderboardVisibility = d.leaderboardVisibility;
};

// ── Save ──

const save = async () => {
  if (imageLayerCount(settings.value.cardTemplate.elements) > MAX_IMAGE_LAYERS) {
    toast.add({
      title: "Image layer limit reached",
      description: `A ${rankCardProfile.noun} can contain up to 10 images.`,
      color: "error",
    });
    return;
  }
  // Captured before the await so an edit made while saving stays dirty.
  const sent = snapshot();
  saving.value = true;

  const ok = await saveModuleSettings("xp", {
    // The save replaces the module's whole settings blob, so keep any keys
    // this page doesn't know about.
    ...getModuleConfig("xp"),
    cooldownSeconds: settings.value.cooldownSeconds,
    minXpPerMessage: settings.value.minXpPerMessage,
    maxXpPerMessage: settings.value.maxXpPerMessage,
    minMessageLength: settings.value.minMessageLength,
    announcementChannel: settings.value.announcementChannel || null,
    levelUpMessage: settings.value.levelUpMessage,
    leaderboardVisibility: settings.value.leaderboardVisibility,
    cardTemplate: settings.value.cardTemplate,
    excludedChannelIds: settings.value.excludedChannelIds,
    excludedRoleIds: settings.value.excludedRoleIds,
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) baseline.value = sent;

  saving.value = false;
};

const discard = () => {
  settings.value = JSON.parse(baseline.value);
  editorKey.value++;
};

onMounted(() => {
  const saved = getModuleConfig("xp");
  if (saved && Object.keys(saved).length > 0) {
    settings.value = {
      cooldownSeconds: saved.cooldownSeconds ?? 60,
      minXpPerMessage: saved.minXpPerMessage ?? 15,
      maxXpPerMessage: saved.maxXpPerMessage ?? 25,
      minMessageLength: saved.minMessageLength ?? 5,
      announcementChannel: saved.announcementChannel ?? "",
      levelUpMessage: saved.levelUpMessage ?? DEFAULT_LEVEL_UP_MESSAGE,
      leaderboardVisibility: saved.leaderboardVisibility ?? "private",
      // Cloned to detach the editable object from the reactive parse and to protect the DEFAULT_RANK_CARD_TEMPLATE
      // constant, which the card designer now mutates in place.
      cardTemplate: JSON.parse(JSON.stringify(saved.cardTemplate ?? DEFAULT_RANK_CARD_TEMPLATE)),
      excludedChannelIds: Array.isArray(saved.excludedChannelIds) ? [...saved.excludedChannelIds] : [],
      excludedRoleIds: Array.isArray(saved.excludedRoleIds) ? [...saved.excludedRoleIds] : [],
    };
  }
  baseline.value = snapshot();
  loadChannels();
  loadRoles();
});

onUnmounted(() => {
  resetPageChrome();
});
</script>
