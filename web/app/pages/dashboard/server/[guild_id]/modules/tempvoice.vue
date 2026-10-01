<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-mic-vocal"
      title="Temporary Voice Channels"
      description="Join-to-Create lobbies that give each member a personal voice channel."
      :enabled="isModuleEnabled('tempvoice')"
    />

    <!-- ── Lobbies ── -->
    <DashboardModuleSection
      title="Lobby channels"
      description="Members who join a lobby are moved into a new channel of their own. It's deleted when everyone leaves."
    >
      <div class="space-y-4">
        <div
          v-if="settings.lobbyChannelIds.length === 0"
          class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-8 text-center"
        >
          <span
            class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
          >
            <UIcon name="i-lucide-volume-2" class="h-5 w-5 text-sky-200" />
          </span>
          <div>
            <h4 class="text-sm font-semibold text-white">No lobbies yet</h4>
            <p class="mt-1 text-[13px] text-gray-400">
              Pick a voice channel below, or run <code class="font-mono">/tempvoice lobby</code> in
              Discord.
            </p>
          </div>
        </div>

        <ul v-else class="-mx-2 divide-y divide-white/[0.06]">
          <li
            v-for="(channelId, index) in settings.lobbyChannelIds"
            :key="channelId"
            class="flex items-center gap-3 px-2 py-2.5"
          >
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-200/10 text-sky-200"
            >
              <UIcon name="i-lucide-volume-2" class="h-4 w-4" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-white">
                {{ channelName(channelId) ?? channelId }}
              </p>
              <p
                v-if="channelName(channelId) === undefined && channelsLoaded"
                class="mt-0.5 inline-flex items-center gap-1 text-[13px] text-amber-300"
              >
                <UIcon name="i-lucide-triangle-alert" class="h-3.5 w-3.5" />
                Channel not found. It may have been deleted.
              </p>
            </div>
            <UButton
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-x"
              :aria-label="`Remove lobby ${channelName(channelId) ?? channelId}`"
              @click="removeLobby(index)"
            />
          </li>
        </ul>

        <div class="flex items-center gap-2">
          <div v-if="channelsLoading" class="flex items-center gap-2 py-2 text-gray-400">
            <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
            <span class="text-sm">Loading channels…</span>
          </div>
          <template v-else>
            <USelectMenu
              v-if="availableLobbyOptions.length > 0"
              v-model="newLobbyId"
              :items="availableLobbyOptions"
              value-key="value"
              placeholder="Choose a voice channel…"
              searchable
              icon="i-lucide-volume-2"
              class="min-w-0 flex-1"
            />
            <p v-else class="flex-1 py-2 text-sm italic text-gray-500">
              {{
                voiceChannels.length === 0
                  ? "No voice channels found. Make sure the bot is in this server."
                  : "Every voice channel is already a lobby."
              }}
            </p>
            <UButton
              color="primary"
              icon="i-lucide-plus"
              :disabled="!newLobbyId"
              @click="addLobby"
            >
              Add lobby
            </UButton>
          </template>
        </div>

        <p class="border-t border-white/[0.06] pt-4 text-[13px] text-gray-400">
          Channel owners can rename, lock, unlock, set a limit on and claim their channel with the
          <code class="font-mono">/tempvoice</code> commands.
        </p>
      </div>
    </DashboardModuleSection>

    <!-- ── Defaults ── -->
    <DashboardModuleSection
      title="Channel defaults"
      description="How new temporary channels are named and limited."
    >
      <div class="space-y-5">
        <div>
          <UFormField label="Naming template" class="w-full">
            <UInput
              v-model="settings.namingTemplate"
              placeholder="{username}'s Channel"
              icon="i-lucide-pencil"
              class="w-full"
            />
          </UFormField>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <span class="text-[13px] text-gray-400">Insert:</span>
            <button
              v-for="token in namingTokens"
              :key="token"
              type="button"
              class="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[12px] text-sky-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-sky-200/10 hover:ring-sky-200/30 focus-visible:outline-2 focus-visible:outline-teal-300"
              @click="insertToken(token)"
            >
              {{ token }}
            </button>
          </div>
          <p
            class="mt-3 flex items-center gap-2 rounded-lg bg-sky-200/[0.06] px-3 py-2 text-[13px] text-sky-200"
          >
            <UIcon name="i-lucide-volume-2" class="h-4 w-4 shrink-0" />
            <span>
              Preview:
              <strong class="font-semibold">{{ namePreview || "(empty name)" }}</strong>
            </span>
          </p>
        </div>

        <div>
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <label class="text-sm font-medium text-white" for="tempvoice-limit">User limit</label>
            <span class="text-sm text-sky-200">
              {{
                settings.defaultUserLimit === 0
                  ? "Unlimited"
                  : `${settings.defaultUserLimit} user${settings.defaultUserLimit !== 1 ? "s" : ""}`
              }}
            </span>
          </div>
          <div class="flex items-center gap-3">
            <USlider
              id="tempvoice-limit"
              v-model="settings.defaultUserLimit"
              :min="0"
              :max="99"
              :step="1"
              class="flex-1"
            />
            <UInput
              v-model.number="settings.defaultUserLimit"
              type="number"
              :min="0"
              :max="99"
              size="sm"
              class="w-20"
              aria-label="User limit"
            />
          </div>
          <p class="mt-2 text-[13px] text-gray-400">
            0 means unlimited. Owners can change it for their own channel with
            <code class="font-mono">/tempvoice limit</code>.
          </p>
        </div>

        <UFormField
          label="Category"
          description="Where new channels are created."
          class="w-full"
        >
          <div v-if="channelsLoading" class="flex items-center gap-2 py-2 text-gray-400">
            <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
            <span class="text-sm">Loading channels…</span>
          </div>
          <USelectMenu
            v-else
            v-model="settings.categoryId"
            :items="categoryOptions"
            value-key="value"
            searchable
            icon="i-lucide-folder"
            class="w-full"
          />
        </UFormField>
        <p
          v-if="categoryMissing"
          class="flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
        >
          <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
          The saved category (ID {{ settings.categoryId }}) wasn't found. It may have been deleted.
        </p>
      </div>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="tempvoice" />

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { DiscordChannel } from "~/composables/useServerSettings";

const route = useRoute();
const guildId = route.params.guild_id as string;
const { isModuleEnabled, saveModuleSettings, getModuleConfig } = useServerSettings(guildId);
const toast = useToast();

const saving = ref(false);
const newLobbyId = ref("");

// Discord channel types
const GUILD_VOICE = 2;
const GUILD_CATEGORY = 4;
const NO_CATEGORY = "none";

// ── Settings ──

interface TempVoiceSettingsForm {
  lobbyChannelIds: string[];
  defaultUserLimit: number;
  namingTemplate: string;
  // "none" = same category as the lobby (saved as no categoryId)
  categoryId: string;
}

const defaults = (): TempVoiceSettingsForm => ({
  lobbyChannelIds: [],
  defaultUserLimit: 0,
  namingTemplate: "{username}'s Channel",
  categoryId: NO_CATEGORY,
});

const settings = ref<TempVoiceSettingsForm>(defaults());
// Last loaded/saved values; drives the unsaved-changes bar and Discard.
const baseline = ref<TempVoiceSettingsForm>(defaults());
const dirty = computed(
  () => JSON.stringify(settings.value) !== JSON.stringify(baseline.value),
);

// ── Channels ──

// The shared settings state only holds text channels, so this page loads its
// own voice channels and categories.
const channels = ref<DiscordChannel[]>([]);
const channelsLoading = ref(true);
const channelsLoaded = computed(() => !channelsLoading.value && channels.value.length > 0);

const loadVoiceChannels = async () => {
  try {
    const response = await $fetch<{ channels: DiscordChannel[] }>("/api/discord/channels", {
      params: { guild_id: guildId, types: "voice,category" },
    });
    channels.value = response.channels || [];
  } catch (error) {
    console.error("Error loading channels:", error);
    toast.add({
      title: "Error",
      description: "Failed to load channels. Make sure the bot is in this server.",
      color: "error",
    });
  } finally {
    channelsLoading.value = false;
  }
};

const voiceChannels = computed(() =>
  channels.value.filter((c) => c.type === GUILD_VOICE),
);

const channelName = (id: string): string | undefined =>
  channels.value.find((c) => c.id === id)?.name;

const availableLobbyOptions = computed(() =>
  voiceChannels.value
    .filter((c: any) => !settings.value.lobbyChannelIds.includes(c.id))
    .map((c: any) => ({ label: c.name, value: c.id })),
);

const categoryOptions = computed(() => [
  { label: "Same category as the lobby", value: NO_CATEGORY },
  ...channels.value
    .filter((c) => c.type === GUILD_CATEGORY)
    .map((c) => ({ label: c.name, value: c.id })),
]);

const categoryMissing = computed(
  () =>
    channelsLoaded.value &&
    settings.value.categoryId !== NO_CATEGORY &&
    !categoryOptions.value.some((o) => o.value === settings.value.categoryId),
);

// ── Lobby management ──

const addLobby = () => {
  const id = newLobbyId.value;
  if (id && !settings.value.lobbyChannelIds.includes(id)) {
    settings.value.lobbyChannelIds.push(id);
  }
  newLobbyId.value = "";
};

const removeLobby = (index: number) => {
  settings.value.lobbyChannelIds.splice(index, 1);
};

// ── Naming template ──

const namingTokens = ["{username}", "{displayname}", "{tag}"];

const insertToken = (token: string) => {
  settings.value.namingTemplate = `${settings.value.namingTemplate}${token}`;
};

// Same replacements the bot applies, with a sample member.
const namePreview = computed(() =>
  settings.value.namingTemplate
    .replace(/\{username\}/g, "alex")
    .replace(/\{displayname\}/g, "Alex")
    .replace(/\{tag\}/g, "alex")
    .trim(),
);

// ── Save ──

const save = async () => {
  saving.value = true;
  const ok = await saveModuleSettings("tempvoice", {
    lobbyChannelIds: settings.value.lobbyChannelIds,
    defaultUserLimit: settings.value.defaultUserLimit,
    namingTemplate: settings.value.namingTemplate,
    categoryId:
      settings.value.categoryId === NO_CATEGORY ? undefined : settings.value.categoryId,
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) baseline.value = JSON.parse(JSON.stringify(settings.value));
  saving.value = false;
};

const discard = () => {
  settings.value = JSON.parse(JSON.stringify(baseline.value));
};

// ── Init ──

onMounted(async () => {
  const saved = getModuleConfig("tempvoice");
  if (saved && Object.keys(saved).length > 0) {
    settings.value = {
      lobbyChannelIds: Array.isArray(saved.lobbyChannelIds)
        ? [...saved.lobbyChannelIds]
        : [],
      defaultUserLimit: saved.defaultUserLimit ?? 0,
      namingTemplate: saved.namingTemplate ?? "{username}'s Channel",
      categoryId: saved.categoryId || NO_CATEGORY,
    };
  }
  baseline.value = JSON.parse(JSON.stringify(settings.value));
  await loadVoiceChannels();
});
</script>
