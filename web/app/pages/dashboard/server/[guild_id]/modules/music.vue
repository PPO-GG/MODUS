<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-music"
      title="Music"
      description="Control playback and queue songs, and set how music works in this server."
      :enabled="isModuleEnabled('Music')"
    />

    <!-- ── Tabs ── -->
    <div
      class="inline-flex rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-white/10"
      role="tablist"
      aria-label="Music sections"
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

    <!-- ══════════════ Player ══════════════ -->
    <div
      v-if="activeTab === 'player'"
      class="relative overflow-hidden rounded-2xl bg-gray-950/80 ring-1 ring-inset ring-white/10"
    >
      <!-- Album art, blurred and dimmed behind the content -->
      <div class="absolute inset-0 z-0" aria-hidden="true">
        <img
          v-if="playerState.currentTrack?.thumbnail"
          :src="playerState.currentTrack.thumbnail"
          class="h-full w-full scale-110 object-cover"
          style="filter: blur(60px) saturate(0.5) brightness(0.3)"
          alt=""
        />
        <div v-else class="h-full w-full bg-gradient-to-br from-sky-950/60 via-gray-950 to-teal-950/40" />
        <div class="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/40" />
        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />
      </div>

      <div class="relative z-10 flex min-h-[420px] flex-col lg:max-h-[600px] lg:flex-row">
        <!-- ─── Now playing ─── -->
        <div class="flex w-full shrink-0 flex-col justify-between gap-4 p-5 sm:p-6 lg:w-[26rem]">
          <div class="flex items-center gap-2">
            <span
              class="h-2 w-2 rounded-full"
              :class="
                connected
                  ? playerState.isPlaying
                    ? 'animate-pulse bg-emerald-400'
                    : 'bg-amber-400'
                  : 'bg-red-400'
              "
              aria-hidden="true"
            />
            <span class="font-mono text-[11px] uppercase tracking-wider text-gray-300">
              {{ statusText }}
            </span>
          </div>

          <div v-if="playerState.currentTrack" class="flex flex-1 flex-col justify-center gap-5">
            <div class="flex items-start gap-4">
              <DashboardMusicArt
                :src="playerState.currentTrack.thumbnail"
                :alt="playerState.currentTrack.title"
                class="h-28 w-28 rounded-xl shadow-2xl shadow-black/50 ring-1 ring-white/10"
              />
              <div class="min-w-0 flex-1 pt-1">
                <h3
                  class="truncate text-xl font-semibold leading-tight text-white"
                  :title="playerState.currentTrack.title"
                >
                  {{ playerState.currentTrack.title }}
                </h3>
                <p class="mt-1 truncate text-sm text-gray-300">{{ playerState.currentTrack.author }}</p>
                <p class="mt-0.5 text-xs text-gray-400">
                  Requested by {{ playerState.currentTrack.requestedBy }}
                </p>
                <a
                  v-if="playerState.currentTrack.url"
                  :href="playerState.currentTrack.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mt-2 inline-flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200 focus-visible:outline-2 focus-visible:outline-teal-300"
                >
                  <UIcon name="i-lucide-external-link" class="h-3 w-3" />
                  Open in browser
                </a>
              </div>
            </div>

            <!-- Progress (read-only: the bot exposes seek to commands, not the dashboard) -->
            <div class="space-y-1.5">
              <div
                class="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label="Track progress"
                :aria-valuenow="Math.round(progressPercent)"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="h-full rounded-full bg-teal-300 transition-all duration-1000 ease-linear"
                  :style="{ width: `${progressPercent}%` }"
                />
              </div>
              <div class="flex justify-between text-xs tabular-nums text-gray-400">
                <span>{{ formatMs(playerState.progress) }}</span>
                <span>{{ playerState.currentTrack.duration }}</span>
              </div>
            </div>

            <!-- Controls -->
            <div class="flex items-center justify-center gap-2 sm:gap-3">
              <button
                type="button"
                class="player-btn"
                :class="{ 'player-btn-on': playerState.autoplay }"
                :aria-pressed="playerState.autoplay"
                aria-label="Autoplay recommended songs when the queue ends"
                title="Autoplay recommended songs when the queue ends"
                :disabled="actionLoading"
                @click="setAutoplayFn(!playerState.autoplay)"
              >
                <UIcon name="i-lucide-sparkles" class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="player-btn"
                aria-label="Shuffle queue"
                title="Shuffle queue"
                :disabled="actionLoading"
                @click="shuffleFn"
              >
                <UIcon name="i-lucide-shuffle" class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="player-btn-primary"
                :aria-label="playerState.isPaused ? 'Resume' : 'Pause'"
                :disabled="actionLoading"
                @click="playerState.isPaused ? resumeFn() : pauseFn()"
              >
                <UIcon :name="playerState.isPaused ? 'i-lucide-play' : 'i-lucide-pause'" class="h-5 w-5" />
              </button>
              <button
                type="button"
                class="player-btn"
                aria-label="Skip"
                title="Skip"
                :disabled="actionLoading"
                @click="skipFn"
              >
                <UIcon name="i-lucide-skip-forward" class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="player-btn"
                aria-label="Stop and clear the queue"
                title="Stop and clear the queue"
                :disabled="actionLoading"
                @click="stopFn"
              >
                <UIcon name="i-lucide-square" class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="player-btn"
                aria-label="Lyrics"
                title="Lyrics"
                @click="openLyricsModal"
              >
                <UIcon name="i-lucide-file-text" class="h-4 w-4" />
              </button>
            </div>

            <!-- Volume -->
            <div class="flex items-center gap-3">
              <UIcon :name="volumeIcon" class="h-4 w-4 shrink-0 text-gray-300" />
              <USlider
                :model-value="volumeLocal"
                :min="0"
                :max="100"
                :step="1"
                class="flex-1"
                aria-label="Volume"
                @update:model-value="onVolumeChange"
              />
              <span class="w-9 text-right text-xs tabular-nums text-gray-300">{{ volumeLocal }}%</span>
            </div>
          </div>

          <div v-else class="flex flex-1 flex-col items-center justify-center py-8 text-center">
            <div
              class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-inset ring-white/10"
            >
              <UIcon name="i-lucide-music" class="h-8 w-8 text-gray-500" />
            </div>
            <p class="font-medium text-gray-200">Nothing playing</p>
            <p class="mt-1 max-w-xs text-[13px] text-gray-400">
              Play a song from Discord, or add songs to the playlist and start them with
              <code class="rounded bg-white/[0.06] px-1 text-teal-300">/playqueue</code>.
            </p>
          </div>
        </div>

        <!-- ─── Queue ─── -->
        <div class="flex min-h-0 min-w-0 flex-1 flex-col border-t border-white/[0.06] lg:border-l lg:border-t-0">
          <div class="flex items-center justify-between gap-2 border-b border-white/[0.06] px-5 py-3.5">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-list-music" class="h-4 w-4 text-gray-300" />
              <span class="text-sm font-semibold text-white">{{ isBotActive ? "Queue" : "Playlist" }}</span>
              <span
                v-if="queueRows.length > 0"
                class="rounded-full bg-white/[0.08] px-2 text-[11px] text-gray-300"
              >
                {{ queueRows.length }}{{ isBotActive ? "" : " pending" }}
              </span>
            </div>
            <UButton
              v-if="!isBotActive && preQueueList.length > 0"
              color="neutral"
              variant="ghost"
              size="xs"
              @click="clearPreQueueFn"
            >
              Clear all
            </UButton>
          </div>

          <!-- Add a song -->
          <div ref="searchContainerRef" class="border-b border-white/[0.06] px-4 py-3">
            <UInput
              v-model="searchQuery"
              placeholder="Search or paste a URL to add…"
              icon="i-lucide-search"
              size="sm"
              :loading="searchLoadingState"
              class="w-full"
              aria-label="Search for a song or paste a URL"
              @keydown.enter="onSearchSubmit"
              @keydown.escape="clearSearchFn"
            />

            <div
              v-if="searchResultsList.length > 0"
              class="mt-2 max-h-64 overflow-y-auto rounded-lg bg-gray-900/95 ring-1 ring-inset ring-white/10 backdrop-blur-xl"
            >
              <div
                v-if="isPlaylistResult && searchResultsList.length > 1"
                class="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-teal-300/20 bg-teal-300/10 px-3 py-2 backdrop-blur-xl"
              >
                <div class="flex min-w-0 items-center gap-2">
                  <UIcon name="i-lucide-list-music" class="h-4 w-4 shrink-0 text-teal-300" />
                  <span class="truncate text-xs font-medium text-teal-200">
                    {{ playlistTitle || "Playlist" }} · {{ playlistTrackCount || searchResultsList.length }} tracks
                  </span>
                </div>
                <UButton size="xs" color="primary" variant="soft" :disabled="actionLoading" @click="addAllPlaylistTracks">
                  Add all {{ playlistTrackCount || searchResultsList.length }}
                </UButton>
              </div>

              <button
                v-for="(result, i) in searchResultsList"
                :key="i"
                type="button"
                class="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none"
                @click="addToQueue(result)"
              >
                <span v-if="isPlaylistResult" class="w-5 shrink-0 text-center text-[11px] tabular-nums text-gray-500">
                  {{ i + 1 }}
                </span>
                <DashboardMusicArt :src="result.thumbnail" :alt="result.title" class="h-10 w-10 rounded" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-medium text-white">{{ result.title }}</p>
                  <p class="truncate text-[11px] text-gray-400">{{ result.author }} · {{ result.duration }}</p>
                </div>
                <UIcon name="i-lucide-circle-plus" class="h-5 w-5 shrink-0 text-teal-300" />
              </button>
            </div>
          </div>

          <!-- Rows -->
          <div class="custom-scrollbar max-h-96 min-h-0 flex-1 overflow-y-auto lg:max-h-none">
            <div
              v-if="playerState.currentTrack"
              class="flex items-center gap-3 border-l-2 border-teal-300 bg-teal-300/10 px-4 py-2.5"
            >
              <div class="flex w-5 items-center justify-center">
                <div v-if="playerState.isPlaying" class="playing-bars" aria-label="Playing">
                  <span /><span /><span />
                </div>
                <UIcon v-else name="i-lucide-pause" class="h-3.5 w-3.5 text-teal-300" />
              </div>
              <DashboardMusicArt
                :src="playerState.currentTrack.thumbnail"
                :alt="playerState.currentTrack.title"
                class="h-10 w-10 rounded"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium text-teal-100">{{ playerState.currentTrack.title }}</p>
                <p class="truncate text-[11px] text-teal-200/60">{{ playerState.currentTrack.author }}</p>
              </div>
              <span class="shrink-0 text-[11px] tabular-nums text-teal-200/60">
                {{ playerState.currentTrack.duration }}
              </span>
            </div>

            <div
              v-for="(row, idx) in queueRows"
              :key="`${idx}-${row.url}`"
              class="group flex items-center gap-3 border-b border-white/[0.03] px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
            >
              <span class="w-5 text-center text-[11px] tabular-nums text-gray-500">{{ idx + 1 }}</span>
              <DashboardMusicArt :src="row.thumbnail" :alt="row.title" class="h-10 w-10 rounded" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium text-gray-100">{{ row.title }}</p>
                <p class="truncate text-[11px] text-gray-400">{{ row.author }}</p>
              </div>
              <span class="mr-1 shrink-0 text-[11px] tabular-nums text-gray-400">{{ row.duration }}</span>
              <div
                class="flex items-center gap-0.5 transition-opacity sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100"
              >
                <button
                  v-if="idx > 0"
                  type="button"
                  class="row-btn"
                  :aria-label="`Move ${row.title} up`"
                  @click="moveRow(idx, idx - 1)"
                >
                  <UIcon name="i-lucide-chevron-up" class="h-3.5 w-3.5" />
                </button>
                <button
                  v-if="idx < queueRows.length - 1"
                  type="button"
                  class="row-btn"
                  :aria-label="`Move ${row.title} down`"
                  @click="moveRow(idx, idx + 1)"
                >
                  <UIcon name="i-lucide-chevron-down" class="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  class="row-btn hover:!bg-red-500/20 hover:!text-red-300"
                  :aria-label="`Remove ${row.title}`"
                  @click="removeRow(idx)"
                >
                  <UIcon name="i-lucide-x" class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div
              v-if="queueRows.length === 0"
              class="flex flex-col items-center justify-center px-6 py-12 text-center"
            >
              <UIcon name="i-lucide-list-music" class="mb-2 h-8 w-8 text-gray-600" />
              <template v-if="isBotActive">
                <p class="text-sm text-gray-300">No upcoming tracks</p>
                <p class="mt-0.5 text-xs text-gray-400">Search above to keep the music going.</p>
              </template>
              <template v-else>
                <p class="text-sm text-gray-300">Playlist is empty</p>
                <p class="mt-0.5 max-w-[15rem] text-xs text-gray-400">
                  Search above to queue songs, then start them with
                  <code class="text-teal-300">/playqueue</code> in Discord.
                </p>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════ Settings ══════════════ -->
    <div v-else class="mx-auto max-w-3xl space-y-6">
      <DashboardModuleSection title="Playback" description="How music starts and how much can be queued.">
        <div class="space-y-6">
          <div>
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <label for="music-volume" class="text-sm font-medium text-white">Default volume</label>
              <span class="text-sm tabular-nums text-sky-200">{{ musicSettings.defaultVolume }}%</span>
            </div>
            <USlider id="music-volume" v-model="musicSettings.defaultVolume" :min="1" :max="100" :step="1" />
            <p class="mt-2 text-[13px] text-gray-400">
              The volume new sessions start at. Changing the volume while music plays updates this too.
            </p>
          </div>

          <UFormField
            label="Maximum queue size"
            description="The most tracks that can be queued at once."
            class="w-full"
          >
            <UInput
              v-model.number="musicSettings.maxQueueSize"
              type="number"
              :min="1"
              :max="1000"
              icon="i-lucide-list-music"
              class="w-full sm:max-w-[14rem]"
            />
          </UFormField>

          <label class="flex cursor-pointer items-start gap-3">
            <USwitch v-model="musicSettings.updateNickname" class="mt-0.5" aria-label="Show the current track in the bot's nickname" />
            <span>
              <span class="block text-sm font-medium text-white">Show the current track in the bot's nickname</span>
              <span class="block text-[13px] text-gray-400">
                The nickname is reset when playback stops.
              </span>
            </span>
          </label>
        </div>
      </DashboardModuleSection>

      <DashboardModuleSection
        title="Who can control music"
        description="Applies to playing, skipping, pausing, stopping, volume, effects and queueing, whether from commands, buttons or the AI assistant."
      >
        <UFormField label="DJ role" class="w-full">
          <div v-if="state.rolesLoading" class="flex items-center gap-2 py-2 text-gray-400">
            <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
            <span class="text-sm">Loading roles…</span>
          </div>
          <USelectMenu
            v-else
            v-model="djRoleSelection"
            :items="djRoleOptions"
            value-key="value"
            placeholder="Everyone can control music"
            icon="i-lucide-headphones"
            class="w-full"
          />
        </UFormField>
        <p class="mt-3 text-[13px] text-gray-400">
          {{
            musicSettings.djRoleId
              ? "Only members with this role, and anyone who can manage the server, can control music. Everyone can still see the queue and now playing."
              : "No DJ role set, so anyone in a voice channel can control music."
          }}
          Who can open this dashboard page is set under Module access below.
        </p>
      </DashboardModuleSection>

      <DashboardModuleSection
        title="Audio effects"
        description="Applied automatically when music starts. Pick as many as you like."
      >
        <template #actions>
          <UButton
            v-if="musicSettings.activeFilters.length > 0"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="musicSettings.activeFilters = []"
          >
            Clear all ({{ musicSettings.activeFilters.length }})
          </UButton>
        </template>

        <div class="space-y-5">
          <div v-for="group in filterGroups" :key="group.label">
            <p class="mb-2 font-mono text-[11px] uppercase tracking-wider text-gray-500">{{ group.label }}</p>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                v-for="key in group.keys"
                :key="key"
                type="button"
                :aria-pressed="musicSettings.activeFilters.includes(key)"
                class="flex items-start gap-3 rounded-xl p-3 text-left ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
                :class="
                  musicSettings.activeFilters.includes(key)
                    ? 'bg-sky-200/[0.06] !ring-2 !ring-teal-300/60'
                    : ''
                "
                @click="toggleFilter(key)"
              >
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-medium text-white">{{ availableFilters[key]!.label }}</span>
                  <span class="block text-[13px] text-gray-400">{{ availableFilters[key]!.description }}</span>
                </span>
                <UIcon
                  v-if="musicSettings.activeFilters.includes(key)"
                  name="i-lucide-circle-check"
                  class="mt-0.5 h-4 w-4 shrink-0 text-teal-300"
                />
              </button>
            </div>
          </div>
        </div>
      </DashboardModuleSection>

      <DashboardModuleAccessSection :guild-id="guildId" module-name="music" />

      <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />
    </div>

    <!-- Lyrics -->
    <UModal v-model:open="lyricsModalOpen" :title="lyricsTitle" description="Lyrics for the current track">
      <template #body>
        <div v-if="lyricsLoading" class="flex items-center justify-center py-12">
          <UIcon name="i-lucide-loader-circle" class="h-8 w-8 animate-spin text-sky-200" />
        </div>
        <div v-else class="custom-scrollbar max-h-[60vh] space-y-2 overflow-y-auto whitespace-pre-wrap pr-2 text-sm leading-relaxed text-gray-300">
          {{ lyricsData?.text || "No lyrics available for this track." }}
        </div>
        <p v-if="lyricsData?.source && !lyricsLoading" class="mt-3 text-xs text-gray-500">
          Source: {{ lyricsData.source }}
        </p>
      </template>
    </UModal>
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
  fetchGuildConfigs,
  loadRoles,
  roleOptions,
} = useServerSettings(guildId);
const toast = useToast();

// ── Tabs ──
const tabs = [
  { value: "player", label: "Player", icon: "i-lucide-disc-3" },
  { value: "settings", label: "Settings", icon: "i-lucide-settings-2" },
] as const;
const activeTab = ref<(typeof tabs)[number]["value"]>("player");

// ── Music player (live state) ──
const {
  state: playerState,
  actionLoading,
  searchResults: searchResultsList,
  searchLoading: searchLoadingState,
  isPlaylistResult,
  playlistTrackCount,
  playlistTitle,
  connected,
  isBotActive,
  skip: skipFn,
  pause: pauseFn,
  resume: resumeFn,
  stop: stopFn,
  shuffle: shuffleFn,
  setAutoplay: setAutoplayFn,
  setVolume: setVolumeFn,
  removeTrack: removeTrackFn,
  reorderTrack: reorderTrackFn,
  play: playFn,
  fetchLyrics: fetchLyricsFn,
  search: searchFn,
  clearSearch: clearSearchFn,
  preQueue: preQueueList,
  addToPreQueue: addToPreQueueFn,
  removeFromPreQueue: removeFromPreQueueFn,
  reorderPreQueue: reorderPreQueueFn,
  clearPreQueue: clearPreQueueFn,
} = useMusicPlayer(guildId);

const statusText = computed(() => {
  if (!connected.value) return "Bot offline";
  if (playerState.value.isPlaying) return `Playing in ${playerState.value.voiceChannel || "voice"}`;
  if (playerState.value.isPaused) return "Paused";
  return "Nothing playing";
});

// The live queue while the bot is in a voice channel, otherwise the dashboard playlist.
const queueRows = computed(() => (isBotActive.value ? playerState.value.queue : preQueueList.value));
const moveRow = (from: number, to: number) =>
  isBotActive.value ? reorderTrackFn(from, to) : reorderPreQueueFn(from, to);
const removeRow = (index: number) =>
  isBotActive.value ? removeTrackFn(index) : removeFromPreQueueFn(index);

// ── Lyrics ──
const lyricsModalOpen = ref(false);
const lyricsLoading = ref(false);
const lyricsData = ref<any>(null);
const lyricsTitle = computed(
  () => lyricsData.value?.trackTitle || playerState.value.currentTrack?.title || "Lyrics",
);

const openLyricsModal = async () => {
  lyricsModalOpen.value = true;
  lyricsLoading.value = true;
  lyricsData.value = null;
  try {
    lyricsData.value = await fetchLyricsFn();
  } catch {
    lyricsData.value = {
      text: "No lyrics found for the current track.",
      trackTitle: playerState.value.currentTrack?.title,
    };
  } finally {
    lyricsLoading.value = false;
  }
};

// ── Volume (debounced so dragging sends one request) ──
const volumeLocal = ref(50);
let volumeDebounce: ReturnType<typeof setTimeout> | null = null;

watch(
  () => playerState.value.volume,
  (val) => {
    // Don't fight the slider while it is being dragged.
    if (!volumeDebounce) volumeLocal.value = val;
  },
  { immediate: true },
);

const onVolumeChange = (val: number | undefined) => {
  if (val == null) return;
  volumeLocal.value = val;
  if (volumeDebounce) clearTimeout(volumeDebounce);
  volumeDebounce = setTimeout(() => {
    setVolumeFn(val);
    volumeDebounce = null;
  }, 300);
};

const volumeIcon = computed(() =>
  volumeLocal.value === 0
    ? "i-lucide-volume-x"
    : volumeLocal.value < 50
      ? "i-lucide-volume-1"
      : "i-lucide-volume-2",
);

// ── Progress ──
const progressPercent = computed(() => {
  const { progress, totalDuration } = playerState.value;
  if (!totalDuration || totalDuration <= 0) return 0;
  return Math.min(100, (progress / totalDuration) * 100);
});

const formatMs = (ms: number): string => {
  if (!ms || ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// ── Search / add ──
const searchQuery = ref("");
const searchContainerRef = ref<HTMLElement | null>(null);
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

watch(searchQuery, (val) => {
  if (searchDebounce) clearTimeout(searchDebounce);
  if (!val || val.length < 2) {
    clearSearchFn();
    return;
  }
  searchDebounce = setTimeout(() => searchFn(val), 400);
});

// Click outside closes the results.
const onClickOutsideSearch = (e: MouseEvent) => {
  if (searchContainerRef.value && !searchContainerRef.value.contains(e.target as Node)) {
    clearSearchFn();
  }
};

onUnmounted(() => {
  document.removeEventListener("click", onClickOutsideSearch);
  if (searchDebounce) clearTimeout(searchDebounce);
  if (volumeDebounce) clearTimeout(volumeDebounce);
});

const addFailureText = () =>
  isBotActive.value
    ? "Could not add that song. Is the bot in a voice channel?"
    : "Could not add that song to the playlist.";

/** Adds a URL to the live queue, or to the playlist when the bot isn't playing. */
async function addUrl(url: string, title?: string) {
  if (isBotActive.value) {
    await playFn(url);
    toast.add({ title: "Added to queue", description: title, color: "success" });
    return;
  }
  const result = await addToPreQueueFn(url);
  const added = result?.addedCount ?? 1;
  const total = result?.totalFound ?? added;
  toast.add({
    title:
      added > 1 ? `Added ${added} song${added !== 1 ? "s" : ""} to playlist` : "Added to playlist",
    description:
      added < total ? `Playlist had ${total} tracks but only ${added} fit (queue limit).` : title,
    color: "success",
  });
}

const onSearchSubmit = async () => {
  if (!searchQuery.value) return;

  // A pasted link is added directly; anything else is searched.
  if (/^https?:\/\//i.test(searchQuery.value)) {
    try {
      await addUrl(searchQuery.value);
      searchQuery.value = "";
      clearSearchFn();
    } catch {
      toast.add({ title: "Error", description: addFailureText(), color: "error" });
    }
    return;
  }
  await searchFn(searchQuery.value);
};

const addToQueue = async (searchResult: { url: string; title: string }) => {
  try {
    await addUrl(searchResult.url, searchResult.title);
    searchQuery.value = "";
    clearSearchFn();
  } catch {
    toast.add({ title: "Error", description: addFailureText(), color: "error" });
  }
};

// Sends the original playlist URL in one request so the bot expands it
// server-side, instead of one request per track (~1s each).
const addAllPlaylistTracks = async () => {
  const tracks = [...searchResultsList.value];
  if (tracks.length === 0) return;

  const name = playlistTitle.value || "Playlist";
  const originalQuery = searchQuery.value;
  searchQuery.value = "";
  clearSearchFn();

  const playlistUrl = originalQuery && /^https?:\/\//i.test(originalQuery) ? originalQuery : null;

  try {
    if (playlistUrl) {
      if (isBotActive.value) {
        await playFn(playlistUrl);
        toast.add({ title: "Added playlist to queue", description: name, color: "success" });
      } else {
        const result = await addToPreQueueFn(playlistUrl);
        const added = result?.addedCount ?? tracks.length;
        const total = result?.totalFound ?? added;
        toast.add({
          title: `Added ${added} track${added !== 1 ? "s" : ""} from ${name}`,
          description:
            added < total ? `Playlist had ${total} tracks but only ${added} fit (queue limit).` : undefined,
          color: "success",
        });
      }
      return;
    }

    // No URL to hand over: add the results one by one.
    let addedTotal = 0;
    for (const track of tracks) {
      try {
        if (isBotActive.value) await playFn(track.url);
        else await addToPreQueueFn(track.url);
        addedTotal++;
      } catch {
        // Skip individual failures.
      }
    }
    toast.add({
      title: `Added ${addedTotal} track${addedTotal !== 1 ? "s" : ""} from ${name}`,
      description:
        addedTotal < tracks.length ? `${tracks.length - addedTotal} track(s) could not be added.` : undefined,
      color: "success",
    });
  } catch {
    toast.add({ title: "Error", description: `Could not add tracks from ${name}.`, color: "error" });
  }
};

// ── Settings ──
interface MusicForm {
  defaultVolume: number;
  djRoleId: string;
  updateNickname: boolean;
  maxQueueSize: number;
  activeFilters: string[];
}

const musicSettings = ref<MusicForm>({
  defaultVolume: 50,
  djRoleId: "",
  updateNickname: true,
  maxQueueSize: 200,
  activeFilters: [],
});
const saving = ref(false);
const baseline = ref(JSON.stringify(musicSettings.value));
const dirty = computed(() => JSON.stringify(musicSettings.value) !== baseline.value);

// "none" stands in for "no DJ role" so the menu can offer a way to clear it.
const djRoleOptions = computed(() => [
  { label: "Everyone (no restriction)", value: "none" },
  ...roleOptions.value,
]);
const djRoleSelection = computed({
  get: () => musicSettings.value.djRoleId || "none",
  set: (value: string | null) => {
    musicSettings.value.djRoleId = !value || value === "none" ? "" : value;
  },
});

// ── Audio effects (keys match the bot's filter list) ──
const availableFilters: Record<string, { label: string; description: string }> = {
  bassboost: { label: "Bass boost", description: "Enhances low frequencies" },
  bassboost_high: { label: "Bass boost (heavy)", description: "Extreme bass enhancement" },
  treble: { label: "Treble boost", description: "Enhances high frequencies" },
  nightcore: { label: "Nightcore", description: "Higher pitch and faster tempo" },
  vaporwave: { label: "Vaporwave", description: "Slowed down with a lower pitch" },
  "8D": { label: "8D audio", description: "Rotating spatial audio" },
  surrounding: { label: "Surround", description: "Spatial surround sound" },
  karaoke: { label: "Karaoke", description: "Reduces vocal frequencies" },
  tremolo: { label: "Tremolo", description: "Wavering volume" },
  vibrato: { label: "Vibrato", description: "Wavering pitch" },
  phaser: { label: "Phaser", description: "Sweeping phase effect" },
  chorus: { label: "Chorus", description: "Rich, layered sound" },
  flanger: { label: "Flanger", description: "Jet-like sweeping effect" },
  lofi: { label: "Lo-fi", description: "Warm, low-fidelity sound" },
  normalizer: { label: "Normalizer", description: "Levels out volume" },
  fadein: { label: "Fade in", description: "Gradually increases volume" },
};

const filterGroups = [
  { label: "Bass and treble", keys: ["bassboost", "bassboost_high", "treble"] },
  { label: "Pitch and speed", keys: ["nightcore", "vaporwave"] },
  { label: "Space and vocals", keys: ["8D", "surrounding", "karaoke"] },
  { label: "Modulation", keys: ["tremolo", "vibrato", "phaser", "chorus", "flanger"] },
  { label: "Tone and levels", keys: ["lofi", "normalizer", "fadein"] },
];

const toggleFilter = (key: string) => {
  const filters = musicSettings.value.activeFilters;
  const idx = filters.indexOf(key);
  if (idx >= 0) filters.splice(idx, 1);
  else filters.push(key);
};

const save = async () => {
  saving.value = true;
  // The settings row also holds the dashboard playlist, and the bot rewrites
  // the volume and effects from commands, while saving replaces the whole row.
  // So re-read it and take only the fields changed on this page over it.
  await fetchGuildConfigs();
  const fresh = getModuleConfig("music");
  const base = JSON.parse(baseline.value) as Record<string, unknown>;
  const form = musicSettings.value as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...fresh };
  for (const key of Object.keys(form)) {
    if (!(key in fresh) || JSON.stringify(form[key]) !== JSON.stringify(base[key])) {
      merged[key] = form[key];
    }
  }
  const ok = await saveModuleSettings("music", merged);
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) {
    musicSettings.value = {
      defaultVolume: merged.defaultVolume as number,
      djRoleId: merged.djRoleId as string,
      updateNickname: merged.updateNickname as boolean,
      maxQueueSize: merged.maxQueueSize as number,
      activeFilters: merged.activeFilters as string[],
    };
    baseline.value = JSON.stringify(musicSettings.value);
  }
  saving.value = false;
};

const discard = () => {
  musicSettings.value = JSON.parse(baseline.value);
};

onMounted(() => {
  document.addEventListener("click", onClickOutsideSearch);
  loadRoles();

  const saved = getModuleConfig("music");
  if (saved && Object.keys(saved).length > 0) {
    musicSettings.value = {
      defaultVolume: saved.defaultVolume ?? 50,
      djRoleId: saved.djRoleId ?? "",
      updateNickname: saved.updateNickname ?? true,
      maxQueueSize: saved.maxQueueSize ?? 200,
      activeFilters: saved.activeFilters ?? [],
    };
  }
  baseline.value = JSON.stringify(musicSettings.value);
});
</script>

<style scoped>
.player-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 2.25rem;
  width: 2.25rem;
  border-radius: 9999px;
  color: rgba(255, 255, 255, 0.65);
  background: rgba(255, 255, 255, 0.05);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}
.player-btn:hover:not(:disabled) {
  color: white;
  background: rgba(255, 255, 255, 0.12);
}
.player-btn:focus-visible,
.player-btn-primary:focus-visible,
.row-btn:focus-visible {
  outline: 2px solid rgb(94, 234, 212);
  outline-offset: 2px;
}
.player-btn:disabled,
.player-btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.player-btn-on {
  color: rgb(94, 234, 212);
  background: rgba(94, 234, 212, 0.12);
  box-shadow: inset 0 0 0 1px rgba(94, 234, 212, 0.4);
}

.player-btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 3rem;
  width: 3rem;
  border-radius: 9999px;
  color: #0a0a0f;
  background: white;
  box-shadow: 0 4px 20px rgba(255, 255, 255, 0.15);
  transition: transform 0.2s ease;
}
.player-btn-primary:hover:not(:disabled) {
  transform: scale(1.06);
}

.row-btn {
  display: flex;
  height: 1.75rem;
  width: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  color: rgb(156, 163, 175);
  transition:
    color 0.2s ease,
    background-color 0.2s ease;
}
.row-btn:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
}

.playing-bars {
  display: flex;
  align-items: flex-end;
  gap: 1.5px;
  height: 14px;
}
.playing-bars span {
  display: block;
  width: 2.5px;
  border-radius: 1px;
  background: rgb(94, 234, 212);
  animation: bar-bounce 0.8s ease-in-out infinite;
}
.playing-bars span:nth-child(2) {
  animation-delay: 0.15s;
}
.playing-bars span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes bar-bounce {
  0%,
  100% {
    height: 4px;
  }
  50% {
    height: 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .playing-bars span {
    animation: none;
    height: 10px;
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}
</style>
