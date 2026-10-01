<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-mic"
      title="Recording"
      description="Record voice channels, and manage what's been recorded."
      :enabled="isModuleEnabled('Recording')"
    />

    <!-- ── Tabs ── -->
    <div
      class="inline-flex rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-white/10"
      role="tablist"
      aria-label="Recording sections"
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
        <span
          v-if="tab.value === 'recordings' && !loadingRecordings"
          class="rounded-full bg-white/[0.08] px-1.5 text-[11px] text-gray-300"
        >
          {{ recordings.length }}
        </span>
      </button>
    </div>

    <!-- ══════════════ Recordings ══════════════ -->
    <DashboardModuleSection
      v-if="activeTab === 'recordings'"
      title="Recordings"
      :description="
        loadingRecordings
          ? 'Loading recordings…'
          : `${recordings.length} recording${recordings.length !== 1 ? 's' : ''}.`
      "
    >
      <template #actions>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-rotate-cw"
          :loading="loadingRecordings"
          aria-label="Refresh recordings"
          @click="fetchRecordings"
        />
      </template>

      <div class="space-y-4">
        <UInput
          v-model="searchQuery"
          placeholder="Search by title or channel…"
          icon="i-lucide-search"
          class="w-full"
          aria-label="Search recordings"
        />

        <div v-if="loadingRecordings" class="space-y-2" aria-busy="true">
          <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-lg bg-white/[0.04]" />
        </div>

        <div
          v-else-if="filteredRecordings.length === 0"
          class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center"
        >
          <span
            class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
          >
            <UIcon name="i-lucide-mic" class="h-5 w-5 text-sky-200" />
          </span>
          <div>
            <h4 class="text-sm font-semibold text-white">
              {{ recordings.length === 0 ? "No recordings yet" : "Nothing matches your search" }}
            </h4>
            <p v-if="recordings.length === 0" class="mt-1 text-[13px] text-gray-400">
              Run <code class="font-mono">/record start</code> in a voice channel to make one.
            </p>
          </div>
        </div>

        <ul v-else class="-mx-2 divide-y divide-white/[0.06]">
          <li v-for="rec in paginatedRecordings" :key="rec.$id">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-3">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-200/10 text-sky-200"
              >
                <UIcon name="i-lucide-audio-lines" class="h-4 w-4" />
              </span>

              <div class="min-w-0 flex-1 basis-48">
                <p class="truncate text-sm font-medium text-white">{{ rec.title || rec.channel_name }}</p>
                <p class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-gray-400">
                  <span>{{ formatDateTime(rec.started_at) }}</span>
                  <span v-if="rec.duration" class="font-mono">{{ formatDuration(rec.duration) }}</span>
                  <span v-if="rec.bitrate" class="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px]">
                    {{ rec.bitrate }} kbps
                  </span>
                  <span
                    v-if="rec.participants"
                    class="inline-flex items-center gap-1"
                    :title="`${getParticipantCount(rec.participants)} participants`"
                  >
                    <UIcon name="i-lucide-users" class="h-3.5 w-3.5" />
                    {{ getParticipantCount(rec.participants) }}
                  </span>
                </p>
              </div>

              <div class="ml-auto flex items-center gap-1">
                <UButton
                  color="neutral"
                  variant="soft"
                  size="sm"
                  :icon="expandedId === rec.$id ? 'i-lucide-chevron-up' : 'i-lucide-play'"
                  @click="toggleExpand(rec)"
                >
                  {{ expandedId === rec.$id ? "Hide" : rec.mixed_file_id ? "Play" : "Tracks" }}
                </UButton>
                <UButton
                  color="error"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-trash-2"
                  :loading="deletingId === rec.$id"
                  :aria-label="`Delete ${rec.title || rec.channel_name}`"
                  @click="confirmDelete(rec)"
                />
              </div>
            </div>

            <div v-if="expandedId === rec.$id" class="rounded-lg bg-black/25 p-3 mb-2 mx-1">
              <div
                v-if="loadingTracks"
                class="flex items-center justify-center gap-2 py-6 text-sm text-gray-400"
              >
                <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
                Loading tracks…
              </div>
              <p
                v-else-if="expandedTracks.length === 0 && !rec.mixed_file_id"
                class="py-6 text-center text-[13px] text-gray-400"
              >
                No audio tracks found for this recording.
              </p>
              <RecordingMultiTrackPlayer
                v-else-if="expandedTracks.length > 0"
                :tracks="expandedTracks"
                :mixed-file-id="rec.mixed_file_id"
                :recording-title="rec.title || rec.channel_name"
                :recording-duration="rec.duration || 0"
              />
              <div v-else-if="rec.mixed_file_id" class="space-y-2">
                <p class="flex items-center gap-2 text-[13px] font-medium text-gray-300">
                  <UIcon name="i-lucide-volume-2" class="h-4 w-4 text-sky-200" />
                  Mixed audio
                </p>
                <audio
                  controls
                  :src="getStreamUrl(rec.mixed_file_id)"
                  class="h-8 w-full"
                  preload="none"
                />
              </div>
            </div>
          </li>
        </ul>

        <div
          v-if="totalPages > 1"
          class="flex items-center justify-between border-t border-white/[0.06] pt-3"
        >
          <span class="text-[13px] text-gray-400">
            {{ (currentPage - 1) * perPage + 1 }} to
            {{ Math.min(currentPage * perPage, filteredRecordings.length) }} of
            {{ filteredRecordings.length }}
          </span>
          <div class="flex gap-1">
            <UButton
              icon="i-lucide-chevron-left"
              size="sm"
              variant="ghost"
              color="neutral"
              aria-label="Previous page"
              :disabled="currentPage <= 1"
              @click="currentPage--"
            />
            <UButton
              icon="i-lucide-chevron-right"
              size="sm"
              variant="ghost"
              color="neutral"
              aria-label="Next page"
              :disabled="currentPage >= totalPages"
              @click="currentPage++"
            />
          </div>
        </div>
      </div>
    </DashboardModuleSection>

    <!-- ══════════════ Settings ══════════════ -->
    <template v-else>
      <!-- Quality -->
      <DashboardModuleSection
        title="Quality"
        description="Higher bitrates sound better but make larger files. 128 kbps and above require Premium."
      >
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Recording quality">
          <label
            v-for="option in bitrateOptions"
            :key="option.value"
            class="block"
            :class="isBitrateLocked(option.value) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
          >
            <input
              v-model="recordingSettings.bitrate"
              type="radio"
              name="recording-bitrate"
              :value="option.value"
              :disabled="isBitrateLocked(option.value)"
              class="peer sr-only"
            />
            <div
              class="flex h-full flex-col gap-1 rounded-xl p-3.5 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-checked:bg-sky-200/[0.06] peer-checked:ring-2 peer-checked:ring-teal-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-semibold text-white">{{ option.label }}</span>
                <UBadge
                  v-if="isPremiumBitrate(option.value)"
                  label="Premium"
                  color="warning"
                  variant="subtle"
                  size="sm"
                  icon="i-lucide-crown"
                />
                <UIcon
                  v-if="recordingSettings.bitrate === option.value"
                  name="i-lucide-circle-check"
                  class="h-5 w-5 text-teal-300"
                />
              </div>
              <span class="text-[13px] text-gray-400">{{ option.description }}</span>
              <span class="mt-auto pt-1 font-mono text-xs text-gray-500">{{ option.estimate }}</span>
            </div>
          </label>
        </div>
      </DashboardModuleSection>

      <!-- Limits (fixed per tier by the bot operator; read-only here) -->
      <DashboardModuleSection
        title="Limits"
        description="Recording limits are set by your plan and can't be changed per server."
      >
        <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="rounded-xl p-3.5 ring-1 ring-inset ring-white/10">
            <dt class="text-[13px] text-gray-400">Max recording length</dt>
            <dd class="mt-1 text-sm font-semibold text-white">
              {{ formatDuration(maxRecordingSeconds) }}
            </dd>
          </div>
          <div class="rounded-xl p-3.5 ring-1 ring-inset ring-white/10">
            <dt class="text-[13px] text-gray-400">Max users recorded at once</dt>
            <dd class="mt-1 text-sm font-semibold text-white">{{ MAX_RECORDING_USERS }} users</dd>
          </div>
        </dl>
        <p v-if="!isPremium && premiumStoreUrl" class="mt-3 text-[13px]">
          <a
            :href="premiumStoreUrl"
            target="_blank"
            rel="noopener"
            class="text-sky-300 underline-offset-2 hover:underline"
          >
            Upgrade for longer recordings
          </a>
        </p>
      </DashboardModuleSection>

      <!-- Announcement -->
      <DashboardModuleSection
        title="Announcement"
        description="How members are told a recording has started."
      >
        <div class="space-y-5">
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Announcement mode">
            <label v-for="option in announceModeOptions" :key="option.value" class="block cursor-pointer">
              <input
                v-model="recordingSettings.announceMode"
                type="radio"
                name="recording-announce"
                :value="option.value"
                class="peer sr-only"
              />
              <div
                class="flex h-full items-start gap-3 rounded-xl p-3.5 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-checked:bg-sky-200/[0.06] peer-checked:ring-2 peer-checked:ring-teal-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
              >
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-200/10 text-sky-200"
                >
                  <UIcon :name="option.icon" class="h-4 w-4" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-semibold text-white">{{ option.label }}</span>
                  <span class="block text-[13px] leading-relaxed text-gray-400">{{ option.description }}</span>
                </span>
                <UIcon
                  v-if="recordingSettings.announceMode === option.value"
                  name="i-lucide-circle-check"
                  class="h-5 w-5 shrink-0 text-teal-300"
                />
              </div>
            </label>
          </div>

          <!-- Spoken / posted text -->
          <div
            v-if="recordingSettings.announceMode === 'tts' || recordingSettings.announceMode === 'textTts'"
            class="space-y-5 border-t border-white/[0.06] pt-5"
          >
            <div>
              <UFormField label="Announcement text" hint="Optional" class="w-full">
                <UTextarea
                  v-model="recordingSettings.announceText"
                  :rows="2"
                  :maxlength="500"
                  :placeholder="DEFAULT_ANNOUNCE_TEXT"
                  autoresize
                  class="w-full"
                />
              </UFormField>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <span class="text-[13px] text-gray-400">Insert:</span>
                <button
                  type="button"
                  class="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[12px] text-sky-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-sky-200/10 hover:ring-sky-200/30 focus-visible:outline-2 focus-visible:outline-teal-300"
                  @click="insertChannelTag"
                >
                  {channel}
                </button>
                <span class="text-[13px] text-gray-400">
                  is replaced with the voice channel's name. Leave blank for the default.
                </span>
              </div>
              <p class="mt-3 flex items-start gap-2 rounded-lg bg-sky-200/[0.06] px-3 py-2 text-[13px] text-sky-200">
                <UIcon name="i-lucide-volume-2" class="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {{ recordingSettings.announceMode === "tts" ? "Spoken:" : "Posted as a text-to-speech message:" }}
                  <strong class="font-semibold">“{{ announcePreview }}”</strong>
                </span>
              </p>
            </div>

            <div v-if="recordingSettings.announceMode === 'tts'">
              <span class="mb-2 block text-sm font-medium text-white">Voice</span>
              <div class="flex items-center gap-2">
                <USelectMenu
                  v-model="announceVoiceModel"
                  :items="voiceOptions"
                  value-key="value"
                  :search-input="false"
                  placeholder="Select a Kokoro voice…"
                  icon="i-lucide-mic"
                  class="min-w-0 flex-1"
                />
                <UButton
                  color="neutral"
                  variant="soft"
                  :icon="previewingVoice ? 'i-lucide-square' : 'i-lucide-play'"
                  :loading="loadingVoicePreview"
                  :disabled="loadingVoicePreview"
                  @click="toggleVoicePreview"
                >
                  {{ previewingVoice ? "Stop" : "Preview" }}
                </UButton>
              </div>
              <p class="mt-2 text-[13px] text-gray-400">
                Default uses the <code class="font-mono">KOKORO_VOICE</code> setting on the bot.
              </p>
            </div>
          </div>

          <!-- Sound clip -->
          <div v-if="recordingSettings.announceMode === 'soundClip'" class="space-y-3 border-t border-white/[0.06] pt-5">
            <span class="block text-sm font-medium text-white">Sound clip</span>

            <div
              v-if="recordingSettings.announceSoundFileId"
              class="flex items-center gap-3 rounded-lg bg-white/[0.03] p-3 ring-1 ring-inset ring-white/10"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-200/10 text-sky-200"
              >
                <UIcon name="i-lucide-music" class="h-4 w-4" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm text-white">Announcement clip uploaded</p>
                <p class="truncate font-mono text-xs text-gray-500">{{ recordingSettings.announceSoundFileId }}</p>
              </div>
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-play"
                aria-label="Play clip"
                @click="previewAnnounceClip"
              />
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                :loading="deletingAnnounce"
                aria-label="Delete clip"
                @click="deleteAnnounceClip"
              />
            </div>

            <div
              class="relative rounded-lg border-2 border-dashed p-5 text-center transition-colors"
              :class="
                isDraggingClip
                  ? 'border-teal-300 bg-teal-300/[0.06]'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              "
              @dragover.prevent="isDraggingClip = true"
              @dragleave="isDraggingClip = false"
              @drop.prevent="handleClipDrop"
            >
              <input
                ref="clipFileInput"
                type="file"
                accept="audio/*,.ogg,.mp3,.wav,.m4a,.flac,.aac"
                class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Upload a sound clip"
                @change="handleClipSelect"
              />
              <div v-if="uploadingAnnounce" class="flex flex-col items-center gap-2">
                <UIcon name="i-lucide-loader-circle" class="h-5 w-5 animate-spin text-sky-200" />
                <span class="text-sm text-gray-300">Uploading…</span>
              </div>
              <div v-else class="flex flex-col items-center gap-1.5">
                <UIcon name="i-lucide-upload" class="h-5 w-5 text-gray-400" />
                <span class="text-sm text-gray-200">
                  {{ recordingSettings.announceSoundFileId ? "Replace" : "Upload" }} sound clip
                </span>
                <span class="text-xs text-gray-500">Max 10 seconds, 5 MB. mp3, ogg, wav, m4a or flac.</span>
              </div>
            </div>
            <p class="text-[13px] text-gray-400">
              Uploading or deleting a clip takes effect straight away and doesn't wait for Save.
            </p>
          </div>
        </div>
      </DashboardModuleSection>

      <!-- Permissions -->
      <DashboardModuleSection
        title="Permissions"
        description="Server admins can always record. Add roles or members who can start recordings too."
      >
        <div class="space-y-5">
          <UFormField label="Allowed roles" class="w-full">
            <div v-if="state.rolesLoading" class="flex items-center gap-2 py-2 text-gray-400">
              <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
              <span class="text-sm">Loading roles…</span>
            </div>
            <USelectMenu
              v-else-if="roleOptions.length > 0"
              v-model="recordingSettings.allowedRoleIds"
              :items="roleOptions"
              value-key="value"
              multiple
              searchable
              placeholder="No extra roles"
              icon="i-lucide-shield-check"
              class="w-full"
            />
            <p v-else class="py-2 text-sm italic text-gray-500">
              No roles available. Make sure the bot is in this server.
            </p>
          </UFormField>

          <div>
            <UFormField
              label="Allowed member IDs"
              description="In Discord, right-click a member and choose Copy User ID."
              class="w-full"
            >
              <div class="flex gap-2">
                <UInput
                  v-model="newUserId"
                  placeholder="Enter a Discord user ID"
                  icon="i-lucide-user"
                  class="min-w-0 flex-1"
                  @keyup.enter="addUserId"
                />
                <UButton
                  color="primary"
                  variant="soft"
                  icon="i-lucide-plus"
                  :disabled="!newUserId.trim()"
                  @click="addUserId"
                >
                  Add
                </UButton>
              </div>
            </UFormField>
            <div v-if="recordingSettings.allowedUserIds.length > 0" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="userId in recordingSettings.allowedUserIds"
                :key="userId"
                class="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] py-1 pl-3 pr-1.5 font-mono text-xs text-gray-200 ring-1 ring-inset ring-white/10"
              >
                {{ userId }}
                <button
                  type="button"
                  class="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-red-300 focus-visible:outline-2 focus-visible:outline-teal-300"
                  :aria-label="`Remove ${userId}`"
                  @click="removeUser(userId)"
                >
                  <UIcon name="i-lucide-x" class="h-3 w-3" />
                </button>
              </span>
            </div>
          </div>
        </div>
      </DashboardModuleSection>

      <DashboardModuleAccessSection :guild-id="guildId" module-name="recording" />

      <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />
    </template>

    <!-- ── Delete confirmation ── -->
    <UModal v-model:open="showDeleteConfirm">
      <template #content>
        <div class="space-y-4 p-6">
          <div class="flex items-center gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-400/10 ring-1 ring-inset ring-red-400/30"
            >
              <UIcon name="i-lucide-triangle-alert" class="h-5 w-5 text-red-300" />
            </span>
            <div>
              <h3 class="text-base font-semibold text-white">Delete recording</h3>
              <p class="text-[13px] text-gray-400">This can't be undone.</p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            Delete
            <strong class="text-white">{{ recordingToDelete?.title || recordingToDelete?.channel_name }}</strong>?
            All of its audio tracks are permanently deleted.
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton color="neutral" variant="ghost" @click="showDeleteConfirm = false">Cancel</UButton>
            <UButton color="error" icon="i-lucide-trash-2" :loading="deletingId !== null" @click="handleDelete">
              Delete recording
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";

const route = useRoute();
const guildId = route.params.guild_id as string;
const {
  state,
  isModuleEnabled,
  saveModuleSettings,
  getModuleConfig,
  loadRoles,
  roleOptions,
} = useServerSettings(guildId);
const toast = useToast();

const tabs = [
  { value: "recordings", label: "Recordings", icon: "i-lucide-audio-lines" },
  { value: "settings", label: "Settings", icon: "i-lucide-sliders-horizontal" },
] as const;
const activeTab = ref<"recordings" | "settings">("recordings");

const saving = ref(false);
const newUserId = ref("");

// ── Settings ──

interface RecordingForm {
  bitrate: number;
  announceMode: "none" | "tts" | "textTts" | "soundClip";
  announceText: string;
  announceVoice: string;
  announceSoundFileId: string;
  allowedRoleIds: string[];
  allowedUserIds: string[];
}

const defaults = (): RecordingForm => ({
  bitrate: 64,
  announceMode: "tts",
  announceText: "",
  announceVoice: "",
  announceSoundFileId: "",
  allowedRoleIds: [],
  allowedUserIds: [],
});

const recordingSettings = ref<RecordingForm>(defaults());

// Last loaded/saved values (JSON); drives the unsaved-changes bar and Discard.
const baseline = ref(JSON.stringify(recordingSettings.value));
const dirty = computed(() => JSON.stringify(recordingSettings.value) !== baseline.value);

// The bot's own default; the placeholder and the preview use it when blank.
const DEFAULT_ANNOUNCE_TEXT = "Recording has started in {channel}. All audio is being captured.";

const announcePreview = computed(() =>
  (recordingSettings.value.announceText.trim() || DEFAULT_ANNOUNCE_TEXT).replace(
    /\{channel\}/g,
    "General voice",
  ),
);

const insertChannelTag = () => {
  const current = recordingSettings.value.announceText;
  if (!current.includes("{channel}")) {
    recordingSettings.value.announceText = `${current}${current && !current.endsWith(" ") ? " " : ""}{channel}`;
  }
};

const VOICE_DEFAULT_SENTINEL = "__default__";
const voiceOptions = [
  { label: "Default (server environment)", value: VOICE_DEFAULT_SENTINEL },
  ...KOKORO_VOICE_LIST.map((v) => ({ label: v.displayName, value: v.id })),
];
const announceVoiceModel = computed({
  get: () =>
    recordingSettings.value.announceVoice || VOICE_DEFAULT_SENTINEL,
  set: (v: string) => {
    recordingSettings.value.announceVoice =
      v === VOICE_DEFAULT_SENTINEL ? "" : v;
  },
});

const loadingVoicePreview = ref(false);
const previewingVoice = ref(false);
let previewAudio: HTMLAudioElement | null = null;

function stopVoicePreview() {
  if (previewAudio) {
    previewAudio.pause();
    previewAudio.src = "";
    previewAudio = null;
  }
  previewingVoice.value = false;
}

async function toggleVoicePreview() {
  if (previewingVoice.value || loadingVoicePreview.value) {
    stopVoicePreview();
    return;
  }
  loadingVoicePreview.value = true;
  try {
    const blob = await $fetch<Blob>("/api/recordings/preview-voice", {
      method: "POST",
      body: {
        voiceId: recordingSettings.value.announceVoice,
        text: recordingSettings.value.announceText,
      },
      responseType: "blob",
    });
    const url = URL.createObjectURL(blob);
    previewAudio = new Audio(url);
    previewAudio.addEventListener("ended", () => {
      previewingVoice.value = false;
      URL.revokeObjectURL(url);
    });
    previewAudio.addEventListener("error", () => {
      previewingVoice.value = false;
      URL.revokeObjectURL(url);
    });
    previewingVoice.value = true;
    await previewAudio.play();
  } catch (err: any) {
    const message =
      err?.data?.statusMessage || err?.message || "Preview failed.";
    toast.add({ title: "Voice preview failed", description: message, color: "error" });
    previewingVoice.value = false;
  } finally {
    loadingVoicePreview.value = false;
  }
}

const announceModeOptions = [
  {
    value: "none" as const,
    label: "None",
    description: "Recording starts silently.",
    icon: "i-lucide-volume-2",
  },
  {
    value: "tts" as const,
    label: "Voice TTS",
    description: "The bot speaks the announcement in the voice channel.",
    icon: "i-lucide-megaphone",
  },
  {
    value: "textTts" as const,
    label: "Text TTS (legacy)",
    description: "Posts a message with Discord's TTS flag, which the client reads aloud.",
    icon: "i-lucide-message-square",
  },
  {
    value: "soundClip" as const,
    label: "Sound clip",
    description: "Plays a custom audio file into the voice channel.",
    icon: "i-lucide-music",
  },
];

// ── Announce Clip State ──

const uploadingAnnounce = ref(false);
const deletingAnnounce = ref(false);
const isDraggingClip = ref(false);
const clipFileInput = ref<HTMLInputElement | null>(null);

const isPremium = ref(false);
const premiumStoreUrl = (useRuntimeConfig().public.premiumStoreUrl as string) || "";
// Mirrors FREE_MAX_RECORDING_BITRATE in @modus/db/recording-limits (the bot and
// PUT route enforce it; @modus/db ships CJS, so it isn't imported client-side).
const FREE_MAX_BITRATE = 64;
// Mirror the session limits in @modus/db/recording-limits (enforced by the bot).
const MAX_RECORDING_USERS = 5;
const FREE_MAX_RECORDING_SECONDS = 60 * 60;
const PREMIUM_MAX_RECORDING_SECONDS = 4 * 60 * 60;
const maxRecordingSeconds = computed(() =>
  isPremium.value ? PREMIUM_MAX_RECORDING_SECONDS : FREE_MAX_RECORDING_SECONDS,
);
const isPremiumBitrate = (bitrate: number) => bitrate > FREE_MAX_BITRATE;
const isBitrateLocked = (bitrate: number) =>
  !isPremium.value && isPremiumBitrate(bitrate);

const bitrateOptions = [
  {
    value: 32,
    label: "Low (voice)",
    description: "Phone-call quality, smallest files.",
    estimate: "~57 MB / 4hr",
  },
  {
    value: 64,
    label: "Standard",
    description: "Good voice quality. Recommended.",
    estimate: "~115 MB / 4hr",
  },
  {
    value: 128,
    label: "High",
    description: "Music-grade quality.",
    estimate: "~230 MB / 4hr",
  },
  {
    value: 256,
    label: "Ultra",
    description: "Near-transparent quality.",
    estimate: "~460 MB / 4hr",
  },
];

// ── Recordings State ──

type Recording = {
  $id: string;
  title?: string;
  channel_name: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  bitrate?: number;
  participants?: string[] | string;
  mixed_file_id?: string;
  recorded_by: string;
  guild_id: string;
};

const recordings = ref<Recording[]>([]);
const loadingRecordings = ref(true);
const expandedId = ref<string | null>(null);
const expandedTracks = ref<any[]>([]);
const loadingTracks = ref(false);
const showDeleteConfirm = ref(false);
const recordingToDelete = ref<Recording | null>(null);
const deletingId = ref<string | null>(null);
const searchQuery = ref("");
const currentPage = ref(1);
const perPage = 10;

// ── Computed ──

const filteredRecordings = computed(() => {
  if (!searchQuery.value) return recordings.value;
  const q = searchQuery.value.toLowerCase();
  return recordings.value.filter(
    (r) =>
      r.title?.toLowerCase().includes(q) ||
      r.channel_name?.toLowerCase().includes(q),
  );
});

const totalPages = computed(() =>
  Math.ceil(filteredRecordings.value.length / perPage),
);

const paginatedRecordings = computed(() =>
  filteredRecordings.value.slice(
    (currentPage.value - 1) * perPage,
    currentPage.value * perPage,
  ),
);

// A new search should start from the first page.
watch(searchQuery, () => {
  currentPage.value = 1;
});

// ── Stream URL (proxied through our server) ──

function getStreamUrl(fileId: string): string {
  return `/api/recordings/stream?file_id=${fileId}`;
}

// ── Formatting ──

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getParticipantCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string" && value.length > 0) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

// ── User Management ──

function addUserId() {
  const id = newUserId.value.trim();
  if (id && !recordingSettings.value.allowedUserIds.includes(id)) {
    recordingSettings.value.allowedUserIds.push(id);
    newUserId.value = "";
  }
}

function removeUser(userId: string) {
  recordingSettings.value.allowedUserIds =
    recordingSettings.value.allowedUserIds.filter((id) => id !== userId);
}

// ── Announce Clip Upload / Delete ──
// Files change straight away, so the setting that points at them is saved
// straight away too (only that key). Otherwise leaving the page without
// pressing Save would leave the saved setting pointing at a deleted file.

async function persistSoundFileId(fileId: string): Promise<boolean> {
  const ok = await saveModuleSettings("recording", {
    ...getModuleConfig("recording"),
    announceSoundFileId: fileId,
  });
  if (ok) {
    recordingSettings.value.announceSoundFileId = fileId;
    // Keep the baseline in step so this doesn't show as an unsaved change.
    const b = JSON.parse(baseline.value);
    b.announceSoundFileId = fileId;
    baseline.value = JSON.stringify(b);
  }
  return ok;
}

async function uploadAnnounceClip(file: File) {
  if (file.size > 5 * 1024 * 1024) {
    toast.add({ title: "File too large", description: "The maximum size is 5 MB.", color: "error" });
    return;
  }

  uploadingAnnounce.value = true;
  try {
    const formData = new FormData();
    formData.append("file", file);

    const result = await $fetch<{ fileId: string }>(
      "/api/recordings/upload-announce",
      { method: "POST", body: formData },
    );

    const oldFileId = recordingSettings.value.announceSoundFileId;

    // Point the setting at the new file first, then remove the old one.
    const saved = await persistSoundFileId(result.fileId);
    if (!saved) {
      await $fetch("/api/recordings/delete-file", {
        method: "POST",
        body: { fileId: result.fileId },
      }).catch(() => {});
      return;
    }

    if (oldFileId) {
      await $fetch("/api/recordings/delete-file", {
        method: "POST",
        body: { fileId: oldFileId },
      }).catch(() => {});
    }
  } catch (err: any) {
    const message =
      err?.data?.statusMessage || err?.message || "Upload failed.";
    toast.add({ title: "Upload failed", description: message, color: "error" });
  } finally {
    uploadingAnnounce.value = false;
  }
}

async function deleteAnnounceClip() {
  const fileId = recordingSettings.value.announceSoundFileId;
  if (!fileId) return;

  deletingAnnounce.value = true;
  try {
    // Clear the setting first, then remove the file.
    if (!(await persistSoundFileId(""))) return;
    await $fetch("/api/recordings/delete-file", {
      method: "POST",
      body: { fileId },
    }).catch(() => {});
  } catch (err) {
    console.error("Error deleting announce clip:", err);
    toast.add({ title: "Couldn't delete the clip", color: "error" });
  } finally {
    deletingAnnounce.value = false;
  }
}

function previewAnnounceClip() {
  if (!recordingSettings.value.announceSoundFileId) return;
  const url = getStreamUrl(recordingSettings.value.announceSoundFileId);
  const audio = new Audio(url);
  audio.play().catch(() => {});
}

function handleClipSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) uploadAnnounceClip(file);
  // Reset the input so same file can be re-selected
  if (input) input.value = "";
}

function handleClipDrop(event: DragEvent) {
  isDraggingClip.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (file) uploadAnnounceClip(file);
}

// ── Save ──

const save = async () => {
  saving.value = true;
  const ok = await saveModuleSettings("recording", {
    // The save replaces the module's whole settings blob, so keep any keys
    // this page doesn't edit.
    ...getModuleConfig("recording"),
    ...recordingSettings.value,
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) baseline.value = JSON.stringify(recordingSettings.value);
  saving.value = false;
};

const discard = () => {
  recordingSettings.value = JSON.parse(baseline.value);
};

// ── Recordings CRUD (server-side API routes) ──

async function fetchRecordings() {
  loadingRecordings.value = true;
  try {
    const data = await $fetch<Recording[]>("/api/recordings/list", {
      params: { guild_id: guildId },
    });
    recordings.value = data;
    currentPage.value = 1;
    expandedId.value = null;
    expandedTracks.value = [];
  } catch (err) {
    console.error("Error fetching recordings:", err);
  } finally {
    loadingRecordings.value = false;
  }
}

async function toggleExpand(rec: Recording) {
  if (expandedId.value === rec.$id) {
    expandedId.value = null;
    expandedTracks.value = [];
    return;
  }

  // Only one recording is open at a time.
  expandedId.value = rec.$id;
  loadingTracks.value = true;
  expandedTracks.value = [];

  try {
    const data = await $fetch<any[]>("/api/recordings/tracks", {
      params: { recording_id: rec.$id },
    });
    // Ignore the response if another row was opened meanwhile.
    if (expandedId.value === rec.$id) expandedTracks.value = data;
  } catch (err) {
    console.error("Error fetching tracks:", err);
    if (expandedId.value === rec.$id) expandedTracks.value = [];
  } finally {
    if (expandedId.value === rec.$id) loadingTracks.value = false;
  }
}

function confirmDelete(rec: Recording) {
  recordingToDelete.value = rec;
  showDeleteConfirm.value = true;
}

async function handleDelete() {
  if (!recordingToDelete.value) return;

  const rec = recordingToDelete.value;
  deletingId.value = rec.$id;

  try {
    await $fetch("/api/recordings/delete", {
      method: "POST",
      body: { recording_id: rec.$id, guild_id: guildId },
    });

    // Remove from local state
    recordings.value = recordings.value.filter((r) => r.$id !== rec.$id);
    showDeleteConfirm.value = false;
    recordingToDelete.value = null;
    if (expandedId.value === rec.$id) {
      expandedId.value = null;
      expandedTracks.value = [];
    }
  } catch (err) {
    console.error("Error deleting recording:", err);
    toast.add({ title: "Couldn't delete the recording", color: "error" });
  } finally {
    deletingId.value = null;
  }
}

// ── Init ──

onMounted(async () => {
  // Load saved settings
  const saved = getModuleConfig("recording");
  if (saved && Object.keys(saved).length > 0) {
    // Backward compat: migrate old ttsAnnounce → announceMode
    let announceMode = saved.announceMode ?? "tts";
    if ("ttsAnnounce" in saved && !("announceMode" in saved)) {
      announceMode = saved.ttsAnnounce ? "tts" : "none";
    }

    recordingSettings.value = {
      bitrate: saved.bitrate ?? 64,
      announceMode,
      announceText: saved.announceText ?? "",
      announceVoice: saved.announceVoice ?? "",
      announceSoundFileId: saved.announceSoundFileId ?? "",
      allowedRoleIds: saved.allowedRoleIds ?? [],
      allowedUserIds: saved.allowedUserIds ?? [],
    };
  }

  // Premium flag lives on the servers row; by-guild-ids returns just the
  // public projection. Non-fatal: falls back to the free tier.
  try {
    const rows = await $fetch<any[]>(
      `/api/servers/by-guild-ids?ids=${encodeURIComponent(guildId)}`,
    );
    isPremium.value = rows[0]?.premium === true;
  } catch {
    // non-fatal — premium-only options stay locked
  }
  // A stale premium value on a free guild would otherwise stay selected (and
  // be re-clamped on save); show what the bot will actually record at.
  if (!isPremium.value) {
    recordingSettings.value.bitrate = Math.min(
      recordingSettings.value.bitrate,
      FREE_MAX_BITRATE,
    );
  }
  baseline.value = JSON.stringify(recordingSettings.value);

  // Load roles for the permission selector
  await loadRoles();

  // Fetch existing recordings
  await fetchRecordings();
});
</script>
