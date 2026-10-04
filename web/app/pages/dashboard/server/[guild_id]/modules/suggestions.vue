<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-lightbulb"
      title="Suggestions"
      description="Members submit ideas with /suggest, the community votes, and staff decide."
      :enabled="isModuleEnabled('suggestions')"
    />

    <DashboardModuleSection
      title="Settings"
      description="Members use /suggest; staff use /suggestion review or the queue below."
    >
      <div class="space-y-5">
        <UFormField
          label="Suggestions channel"
          description="Where new suggestions are posted. A text channel gets an embed plus a thread; a forum or media channel gets one post per suggestion."
          class="w-full"
        >
          <div v-if="state.channelsLoading" class="flex items-center gap-2 py-1.5 text-gray-400">
            <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-emerald-200" />
            <span class="text-sm">Loading channels…</span>
          </div>
          <USelectMenu
            v-else-if="channelOptions.length > 0"
            v-model="settings.channelId"
            :items="suggestionChannelOptions"
            value-key="value"
            placeholder="Select a channel…"
            searchable
            icon="i-lucide-hash"
            class="w-full"
          />
          <p v-else class="py-1.5 text-sm italic text-gray-500">No channels available.</p>
        </UFormField>

        <UFormField
          label="Staff roles"
          description="Members with these roles can review suggestions. Anyone with Manage Server always can."
          class="w-full"
        >
          <div v-if="state.rolesLoading" class="flex items-center gap-2 py-1.5 text-gray-400">
            <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-emerald-200" />
            <span class="text-sm">Loading roles…</span>
          </div>
          <USelectMenu
            v-else
            v-model="settings.staffRoleIds"
            :items="roleOptions"
            value-key="value"
            multiple
            searchable
            placeholder="None (Manage Server only)"
            icon="i-lucide-shield"
            class="w-full"
          />
          <p class="mt-1.5 text-[13px] text-gray-400">
            Up to {{ MAX_STAFF_ROLES }} roles<template v-if="settings.staffRoleIds.length >= MAX_STAFF_ROLES"> — limit reached</template>.
          </p>
        </UFormField>

        <USwitch v-model="settings.createThread" label="Create a discussion thread for each suggestion (text channels only)" />
        <USwitch
          v-model="settings.closeVotingOnDecision"
          label="Close voting when a suggestion is denied or implemented"
        />

        <p class="flex items-start gap-2 text-[13px] text-gray-400">
          <UIcon name="i-lucide-shield-check" class="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            The bot needs to view, send messages and embed links in the channel, and send messages in threads (and create threads if enabled).
            <NuxtLink :to="`/dashboard/server/${guildId}/permissions`" class="text-emerald-300 hover:underline">
              Check bot access on the Permissions page.
            </NuxtLink>
          </span>
        </p>
      </div>
    </DashboardModuleSection>

    <DashboardModuleSection
      title="Panel"
      description="Post a message with a button that opens the suggestion form, so members don't need /suggest. You can also use /suggestion panel in Discord."
    >
      <div class="space-y-5">
        <UFormField label="Title" class="w-full">
          <UInput
            v-model="settings.panelTitle"
            :maxlength="PANEL_LIMITS.title"
            :placeholder="PANEL_DEFAULTS.title"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Blurb"
          :description="`${settings.panelBlurb.length}/${PANEL_LIMITS.blurb}`"
          class="w-full"
        >
          <UTextarea
            v-model="settings.panelBlurb"
            :maxlength="PANEL_LIMITS.blurb"
            :rows="4"
            :placeholder="PANEL_DEFAULTS.blurb"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Button label" class="w-full">
          <UInput
            v-model="settings.panelButtonLabel"
            :maxlength="PANEL_LIMITS.buttonLabel"
            :placeholder="PANEL_DEFAULTS.buttonLabel"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Panel channel"
          description="Where the panel is posted. Text channels only (a forum can't hold a loose message)."
          class="w-full"
        >
          <div v-if="state.channelsLoading" class="flex items-center gap-2 py-1.5 text-gray-400">
            <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-emerald-200" />
            <span class="text-sm">Loading channels…</span>
          </div>
          <USelectMenu
            v-else-if="channelOptions.length > 0"
            v-model="panelTarget"
            :items="channelOptions"
            value-key="value"
            placeholder="Select a channel…"
            searchable
            icon="i-lucide-hash"
            class="w-full"
          />
          <p v-else class="py-1.5 text-sm italic text-gray-500">No channels available.</p>
        </UFormField>

        <div class="flex flex-wrap items-center gap-3">
          <UButton
            color="primary"
            icon="i-lucide-send"
            :loading="deploying"
            :disabled="!settings.channelId || !panelTarget || !!panelValidation"
            @click="postPanel"
          >
            {{ panelButtonText }}
          </UButton>
          <p class="text-[13px] text-gray-400">Posting also saves your settings.</p>
        </div>

        <p v-if="!settings.channelId" class="text-[13px] text-amber-200">
          Choose a suggestions channel first — the panel button needs somewhere to send suggestions.
        </p>

        <p
          v-if="panelValidation || panelError"
          class="flex items-start gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
        >
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
          {{ panelValidation || panelError }}
        </p>
      </div>
    </DashboardModuleSection>

    <DashboardModuleSection title="Review queue" description="Open a suggestion to see who voted and set its status.">
      <div class="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by status">
        <UButton
          v-for="tab in STATUS_TABS"
          :key="tab.value"
          size="xs"
          :variant="status === tab.value ? 'solid' : 'soft'"
          :color="status === tab.value ? 'primary' : 'neutral'"
          role="tab"
          :aria-selected="status === tab.value"
          @click="setStatus(tab.value)"
        >
          {{ tab.label }}
        </UButton>
      </div>

      <div v-if="loading" class="flex items-center gap-2 py-6 text-gray-400">
        <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-emerald-200" />
        <span class="text-sm">Loading…</span>
      </div>
      <p v-else-if="error" class="text-[13px] text-amber-200">{{ error }}</p>
      <div
        v-else-if="items.length === 0"
        class="rounded-lg border border-dashed border-white/10 px-6 py-10 text-center text-sm text-gray-400"
      >
        No {{ statusLabel(status).toLowerCase() }} suggestions.
      </div>

      <ul v-else class="-mx-2 divide-y divide-white/[0.06]">
        <li v-for="item in items" :key="item.id" class="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-3">
          <span class="w-10 shrink-0 text-sm text-gray-500">#{{ item.number }}</span>
          <div class="min-w-0 flex-1 basis-48">
            <button
              type="button"
              class="block max-w-full truncate text-left text-sm font-medium text-white hover:text-emerald-300 focus-visible:outline-2 focus-visible:outline-emerald-300"
              @click="openReview(item)"
            >
              {{ item.title }}
            </button>
            <p class="mt-0.5 text-[13px] text-gray-400">
              {{ item.authorName }} · {{ relativeAge(item.createdAt) }}
            </p>
          </div>
          <span class="shrink-0 text-sm text-gray-300">▲ {{ item.up }} · ▼ {{ item.down }}</span>
          <UBadge :color="statusBadgeColor(item.status)" variant="subtle" size="sm">
            {{ statusLabel(item.status) }}
          </UBadge>
          <div class="ml-auto flex items-center gap-1">
            <UButton
              v-if="messageLink(guildId, item.channelId, item.messageId)"
              :to="messageLink(guildId, item.channelId, item.messageId)!"
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-external-link"
              :aria-label="`Open suggestion ${item.number} in Discord`"
            />
            <UButton
              v-if="item.status !== 'withdrawn'"
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-gavel"
              :aria-label="`Review suggestion ${item.number}`"
              @click="openReview(item)"
            />
          </div>
        </li>
      </ul>

      <div v-if="hasMore && !loading" class="mt-4 flex justify-center">
        <UButton variant="soft" color="neutral" size="sm" :loading="loadingMore" @click="loadMore">
          Load more
        </UButton>
      </div>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="suggestions" />

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />

    <!-- ── Review ── -->
    <UModal
      :open="!!target"
      :title="target ? `#${target.number} ${target.title}` : 'Review'"
      description="Set the status and optionally leave a reason."
      @update:open="(v: boolean) => !v && (target = null)"
    >
      <template #body>
        <div v-if="target" class="space-y-5">
          <p class="whitespace-pre-wrap text-sm text-gray-300">{{ target.body }}</p>
          <p class="text-[13px] text-gray-400">
            Submitted by {{ target.authorName }} · ▲ {{ target.up }} · ▼ {{ target.down }}
          </p>

          <div>
            <span class="mb-1.5 block text-sm font-medium text-white">Voters</span>
            <div v-if="votersLoading" class="flex items-center gap-2 text-gray-400">
              <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-emerald-200" />
              <span class="text-sm">Loading…</span>
            </div>
            <p v-else-if="votersError" class="text-[13px] text-amber-200">{{ votersError }}</p>
            <p v-else-if="voters.length === 0" class="text-sm italic text-gray-500">No votes yet.</p>
            <template v-else>
              <ul class="max-h-32 space-y-1 overflow-y-auto text-sm text-gray-300">
                <li v-for="voter in voters" :key="voter.userId">
                  {{ voter.direction === "up" ? "▲" : "▼" }} {{ voter.displayName }}
                </li>
              </ul>
              <p v-if="votersTotal > voters.length" class="mt-1.5 text-[13px] text-gray-400">
                Showing {{ voters.length }} of {{ votersTotal }} voters
              </p>
            </template>
          </div>

          <UFormField label="Status" class="w-full">
            <USelect v-model="reviewStatus" :items="STAFF_STATUS_OPTIONS" value-key="value" class="w-full" />
          </UFormField>

          <UFormField label="Reason (optional)" class="w-full">
            <UTextarea
              v-model="reviewReason"
              :maxlength="MAX_REASON_LENGTH"
              :rows="3"
              placeholder="Shown on the suggestion"
              class="w-full"
            />
          </UFormField>

          <p
            v-if="reviewError"
            class="flex items-start gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
          >
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
            {{ reviewError }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="target = null">Cancel</UButton>
          <UButton color="primary" :loading="reviewing" :disabled="!!validation" @click="submitReview">
            Save review
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";
import {
  MAX_REASON_LENGTH,
  PANEL_DEFAULTS,
  PANEL_LIMITS,
  STAFF_STATUS_OPTIONS,
  STATUS_TABS,
  messageLink,
  panelResultTitle,
  relativeAge,
  statusBadgeColor,
  statusLabel,
  storedPanelText,
  toSavedPanel,
  validatePanel,
  validateReview,
  type StaffStatus,
} from "~/utils/suggestions";
import type { SuggestionItem } from "~/composables/useSuggestions";

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
  channelOptions,
  roleOptions,
} = useServerSettings(guildId);
const {
  items,
  loading,
  loadingMore,
  error,
  hasMore,
  status,
  voters,
  votersTotal,
  votersLoading,
  votersError,
  setStatus,
  loadMore,
  loadVoters,
  review,
  deployPanel,
} = useSuggestions(guildId);

// ── Settings ─────────────────────────────────────────────────────────

const saving = ref(false);
const settings = reactive<{
  channelId: string;
  staffRoleIds: string[];
  createThread: boolean;
  closeVotingOnDecision: boolean;
  panelTitle: string;
  panelBlurb: string;
  panelButtonLabel: string;
  panelChannelId: string;
  panelMessageId: string;
}>({
  channelId: "",
  staffRoleIds: [],
  createThread: true,
  closeVotingOnDecision: true,
  panelTitle: PANEL_DEFAULTS.title,
  panelBlurb: PANEL_DEFAULTS.blurb,
  panelButtonLabel: PANEL_DEFAULTS.buttonLabel,
  panelChannelId: "",
  panelMessageId: "",
});

// The suggestions channel picker also offers forum + media channels; fail soft to text-only.
const forumOptions = ref<{ label: string; value: string }[] | null>(null);
const suggestionChannelOptions = computed(() => forumOptions.value ?? channelOptions.value);
const loadSuggestionChannels = async () => {
  try {
    const response = await $fetch<{ channels: { id: string; name: string }[] }>(
      "/api/discord/channels",
      { params: { guild_id: guildId, types: "text,forum" } },
    );
    forumOptions.value = (response.channels || []).map((c) => ({ label: `#${c.name}`, value: c.id }));
  } catch {
    // Keep the text-only list from useServerSettings.
  }
};

// The panel channel the admin picks; settings.panelChannelId is where the panel was last posted.
const panelTarget = ref("");
const deploying = ref(false);
const panelError = ref<string | null>(null);
const panelValidation = computed(() =>
  validatePanel({
    title: settings.panelTitle,
    blurb: settings.panelBlurb,
    buttonLabel: settings.panelButtonLabel,
  }),
);
const panelButtonText = computed(() =>
  settings.panelMessageId && settings.panelChannelId === panelTarget.value ? "Update panel" : "Post panel",
);

// The bot's settings schema accepts at most this many staff roles; cap the
// selection so a saved config always parses there.
const MAX_STAFF_ROLES = 25;
watch(
  () => settings.staffRoleIds.length,
  (count) => {
    if (count > MAX_STAFF_ROLES) settings.staffRoleIds = settings.staffRoleIds.slice(0, MAX_STAFF_ROLES);
  },
);

// Last loaded/saved values (JSON); drives the unsaved-changes bar and Discard.
const baseline = ref(JSON.stringify(settings));
const dirty = computed(() => JSON.stringify(settings) !== baseline.value);

const save = async () => {
  saving.value = true;
  const panel = toSavedPanel({
    title: settings.panelTitle,
    blurb: settings.panelBlurb,
    buttonLabel: settings.panelButtonLabel,
  });
  const ok = await saveModuleSettings("suggestions", {
    channelId: settings.channelId || null,
    staffRoleIds: settings.staffRoleIds,
    createThread: settings.createThread,
    closeVotingOnDecision: settings.closeVotingOnDecision,
    panelTitle: panel.title,
    panelBlurb: panel.blurb,
    panelButtonLabel: panel.buttonLabel,
    panelChannelId: settings.panelChannelId || null,
    panelMessageId: settings.panelMessageId || null,
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) baseline.value = JSON.stringify(settings);
  saving.value = false;
};

const discard = () => {
  Object.assign(settings, JSON.parse(baseline.value));
  panelTarget.value = settings.panelChannelId;
};

// ── Review ───────────────────────────────────────────────────────────

const target = ref<SuggestionItem | null>(null);
const reviewStatus = ref<StaffStatus>("approved");
const reviewReason = ref("");
const reviewing = ref(false);
const reviewError = ref<string | null>(null);

const validation = computed(() => validateReview(reviewStatus.value, reviewReason.value));

function openReview(item: SuggestionItem) {
  if (item.status === "withdrawn") return;
  target.value = item;
  reviewStatus.value = (item.status === "pending" ? "approved" : item.status) as StaffStatus;
  reviewReason.value = item.statusReason ?? "";
  reviewError.value = null;
  void loadVoters(item.id);
}

async function submitReview() {
  if (!target.value || validation.value) return;
  reviewing.value = true;
  reviewError.value = null;
  try {
    const result = await review(target.value.id, reviewStatus.value, reviewReason.value);
    if (result.withdrawn) {
      toast.add({
        title: "Suggestion withdrawn",
        description: "Its Discord message was deleted, so it was marked withdrawn.",
        color: "warning",
      });
    } else if (!result.embedUpdated) {
      toast.add({
        title: "Status saved",
        description: "I couldn't update the Discord message — check the bot's access to the channel.",
        color: "warning",
      });
    } else {
      toast.add({ title: "Review saved", color: "success" });
    }
    target.value = null;
  } catch (err: any) {
    reviewError.value = err?.message || "Failed to save the review.";
  } finally {
    reviewing.value = false;
  }
}

// ── Panel ────────────────────────────────────────────────────────────

async function postPanel() {
  if (!settings.channelId || !panelTarget.value || panelValidation.value) return;
  deploying.value = true;
  panelError.value = null;
  try {
    const texts = toSavedPanel({
      title: settings.panelTitle,
      blurb: settings.panelBlurb,
      buttonLabel: settings.panelButtonLabel,
    });
    const result = await deployPanel(panelTarget.value, texts);
    settings.panelTitle = texts.title;
    settings.panelBlurb = texts.blurb;
    settings.panelButtonLabel = texts.buttonLabel;
    settings.panelChannelId = result.panelChannelId;
    settings.panelMessageId = result.panelMessageId;
    toast.add({ title: panelResultTitle(result.action), color: "success" });
    // Persist the new ids (and the texts that were just posted) with the rest of the settings.
    await save();
  } catch (err: any) {
    panelError.value = err?.message || "Failed to post the panel.";
  } finally {
    deploying.value = false;
  }
}

// ── Init ─────────────────────────────────────────────────────────────

onMounted(async () => {
  const saved = getModuleConfig("suggestions");
  if (saved) {
    settings.channelId = typeof saved.channelId === "string" ? saved.channelId : "";
    settings.staffRoleIds = Array.isArray(saved.staffRoleIds) ? saved.staffRoleIds : [];
    settings.createThread = saved.createThread ?? true;
    settings.closeVotingOnDecision = saved.closeVotingOnDecision ?? true;
    settings.panelTitle = storedPanelText(saved.panelTitle, PANEL_LIMITS.title, PANEL_DEFAULTS.title);
    settings.panelBlurb = storedPanelText(saved.panelBlurb, PANEL_LIMITS.blurb, PANEL_DEFAULTS.blurb);
    settings.panelButtonLabel = storedPanelText(
      saved.panelButtonLabel,
      PANEL_LIMITS.buttonLabel,
      PANEL_DEFAULTS.buttonLabel,
    );
    settings.panelChannelId = typeof saved.panelChannelId === "string" ? saved.panelChannelId : "";
    settings.panelMessageId = typeof saved.panelMessageId === "string" ? saved.panelMessageId : "";
  }
  panelTarget.value = settings.panelChannelId;
  baseline.value = JSON.stringify(settings);
  await Promise.all([loadChannels(), loadRoles(), loadSuggestionChannels()]);
});
</script>
