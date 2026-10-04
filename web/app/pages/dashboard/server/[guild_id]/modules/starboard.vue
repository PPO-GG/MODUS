<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-star"
      title="Starboard"
      description="Mirror the best messages to a board channel when they collect enough reactions."
      :enabled="isModuleEnabled('starboard')"
    />

    <DashboardModuleSection
      title="Boards"
      description="Each board watches one emoji. Members' own reactions, bots, NSFW channels and the board channels themselves never count. Messages from channels @everyone can't see are never posted to a channel @everyone can see. A board can watch only chosen channels, and the bot can add its emoji to every image posted there."
    >
      <template #actions>
        <UButton
          color="primary"
          size="sm"
          icon="i-lucide-plus"
          :disabled="settings.boards.length >= MAX_BOARDS"
          @click="openCreate"
        >
          New board
        </UButton>
      </template>

      <div
        v-if="settings.boards.length === 0"
        class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-200/10 ring-1 ring-inset ring-yellow-100/20"
        >
          <UIcon name="i-lucide-star" class="h-5 w-5 text-yellow-200" />
        </span>
        <div>
          <h4 class="text-sm font-semibold text-white">No boards yet</h4>
          <p class="mx-auto mt-1 max-w-sm text-[13px] text-gray-400">
            For example: ⭐ with 3 stars posts to #starboard, 💀 with 5 posts to #hall-of-shame.
          </p>
        </div>
        <UButton color="primary" icon="i-lucide-plus" @click="openCreate">
          Create your first board
        </UButton>
      </div>

      <ul v-else class="-mx-2 divide-y divide-white/[0.06]">
        <li
          v-for="board in settings.boards"
          :key="board.id"
          class="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-3 transition-opacity"
          :class="board.enabled ? '' : 'opacity-60'"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
            :class="board.enabled ? 'bg-yellow-200/10' : 'bg-white/[0.04]'"
          >
            <template v-if="isCustomEmoji(board.emoji)">
              <UIcon name="i-lucide-smile" class="h-4 w-4 text-yellow-200" />
            </template>
            <template v-else>{{ board.emoji }}</template>
          </span>

          <div class="min-w-0 flex-1 basis-48">
            <button
              type="button"
              class="block max-w-full truncate text-left text-sm font-medium text-white hover:text-yellow-300 focus-visible:outline-2 focus-visible:outline-yellow-300"
              @click="openEdit(board)"
            >
              {{ board.name }}
            </button>
            <p class="mt-0.5 text-[13px] text-gray-400">
              {{ describeBoard(board, channelName(board.channelId)) }}
            </p>
          </div>

          <div class="ml-auto flex items-center gap-1">
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-trophy"
              :aria-label="`Leaderboard for ${board.name}`"
              @click="openLeaderboard(board)"
            />
            <USwitch
              v-model="board.enabled"
              size="sm"
              :aria-label="`${board.enabled ? 'Disable' : 'Enable'} ${board.name}`"
            />
            <UButton
              variant="ghost"
              color="neutral"
              size="sm"
              icon="i-lucide-pencil"
              :aria-label="`Edit ${board.name}`"
              @click="openEdit(board)"
            />
            <UButton
              variant="ghost"
              color="error"
              size="sm"
              icon="i-lucide-trash-2"
              :aria-label="`Delete ${board.name}`"
              @click="deleteTarget = board"
            />
          </div>
        </li>
      </ul>

      <p class="mt-4 flex items-start gap-2 text-[13px] text-gray-400">
        <UIcon name="i-lucide-shield-check" class="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          The bot needs to view, send messages and embed links in each board channel.
          <NuxtLink :to="`/dashboard/server/${guildId}/permissions`" class="text-yellow-300 hover:underline">
            Check bot access on the Permissions page.
          </NuxtLink>
        </span>
      </p>
    </DashboardModuleSection>

    <DashboardModuleSection
      v-if="boardForLeaderboard"
      :title="`Leaderboard — ${boardForLeaderboard.name}`"
      description="Most-starred posts and authors for this board."
    >
      <template #actions>
        <UButton variant="ghost" color="neutral" size="sm" icon="i-lucide-x" aria-label="Close leaderboard" @click="boardForLeaderboard = null" />
      </template>
      <div v-if="leaderboardLoading" class="flex items-center gap-2 py-3 text-gray-400">
        <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-yellow-200" />
        <span class="text-sm">Loading…</span>
      </div>
      <p v-else-if="leaderboardError" class="text-[13px] text-amber-200">{{ leaderboardError }}</p>
      <p v-else-if="!leaderboard || leaderboard.posts.length === 0" class="py-3 text-sm italic text-gray-500">
        Nothing has reached this board yet.
      </p>
      <div v-else class="grid gap-6 md:grid-cols-2">
        <div>
          <h4 class="mb-2 text-sm font-semibold text-white">Top posts</h4>
          <ol class="space-y-1.5">
            <li
              v-for="(post, i) in leaderboard.posts"
              :key="post.id"
              class="flex items-center gap-2 text-sm text-gray-300"
            >
              <span class="w-5 text-right text-gray-500">{{ i + 1 }}</span>
              <a
                :href="`https://discord.com/channels/${guildId}/${post.sourceChannelId}/${post.sourceMessageId}`"
                target="_blank"
                rel="noopener noreferrer"
                class="min-w-0 flex-1 truncate hover:text-yellow-300"
              >
                {{ post.authorName }}
              </a>
              <span class="shrink-0 text-yellow-200">{{ post.starCount }}</span>
            </li>
          </ol>
        </div>
        <div>
          <h4 class="mb-2 text-sm font-semibold text-white">Top authors</h4>
          <ol class="space-y-1.5">
            <li
              v-for="(author, i) in leaderboard.authors"
              :key="author.authorId"
              class="flex items-center gap-2 text-sm text-gray-300"
            >
              <span class="w-5 text-right text-gray-500">{{ i + 1 }}</span>
              <span class="min-w-0 flex-1 truncate">{{ author.authorName }}</span>
              <span class="shrink-0 text-gray-500">{{ author.posts }} posts</span>
              <span class="shrink-0 text-yellow-200">{{ author.stars }}</span>
            </li>
          </ol>
        </div>
      </div>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="starboard" />

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />

    <!-- ── Create / edit board ── -->
    <UModal
      :open="!!draft"
      :title="draftIsNew ? 'New board' : 'Edit board'"
      description="Messages that collect enough reactions are posted to the board channel."
      @update:open="(v: boolean) => !v && (draft = null)"
    >
      <template #body>
        <div v-if="draft" class="space-y-5">
          <UFormField label="Board name" class="w-full">
            <UInput v-model="draft.name" placeholder="e.g. Starboard" class="w-full" maxlength="80" autofocus />
          </UFormField>

          <UFormField label="Emoji" class="w-full">
            <div class="space-y-2">
              <UInput
                v-model="draft.emoji"
                placeholder="⭐ or paste a custom emoji"
                class="w-full"
                aria-label="Emoji"
              />
              <div class="flex flex-wrap gap-1.5">
                <UButton
                  v-for="preset in EMOJI_PRESETS"
                  :key="preset"
                  size="xs"
                  variant="soft"
                  color="neutral"
                  :aria-label="`Use ${preset}`"
                  @click="draft.emoji = preset"
                >
                  {{ preset }}
                </UButton>
              </div>
              <p class="text-[13px] text-gray-400">
                Paste a custom emoji from this server (e.g. <code>&lt;:pog:1234…&gt;</code>) or its numeric id.
              </p>
            </div>
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Reactions needed" class="w-full">
              <UInput v-model.number="draft.threshold" type="number" min="1" max="100" class="w-full" />
            </UFormField>
            <UFormField label="Board channel" class="w-full">
              <div v-if="state.channelsLoading" class="flex items-center gap-2 py-1.5 text-gray-400">
                <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-yellow-200" />
                <span class="text-sm">Loading channels…</span>
              </div>
              <USelectMenu
                v-else-if="channelOptions.length > 0"
                v-model="draft.channelId"
                :items="channelOptions"
                value-key="value"
                placeholder="Select a channel…"
                searchable
                icon="i-lucide-hash"
                class="w-full"
              />
              <p v-else class="py-1.5 text-sm italic text-gray-500">No channels available.</p>
            </UFormField>
          </div>

          <UFormField label="Ignored channels" description="Messages in these channels (and their threads) are never posted." class="w-full">
            <USelectMenu
              v-model="draft.ignoredChannelIds"
              :items="sourceChannelOptions"
              value-key="value"
              multiple
              searchable
              placeholder="None"
              icon="i-lucide-eye-off"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Watched channels"
            description="Only reactions in these channels (and their threads) count. Leave empty to watch every channel."
            class="w-full"
          >
            <USelectMenu
              v-model="draft.watchedChannelIds"
              :items="sourceChannelOptions"
              value-key="value"
              multiple
              searchable
              placeholder="All channels"
              icon="i-lucide-eye"
              class="w-full"
            />
          </UFormField>

          <div class="space-y-1">
            <USwitch
              v-model="draft.autoReact"
              :disabled="draft.watchedChannelIds.length === 0"
              label="Add this emoji to every image posted in the watched channels"
            />
            <p class="text-[13px] text-gray-400">
              Members can then vote with one click. Needs at least one watched channel, and the bot needs Add Reactions
              and Read Message History there.
            </p>
          </div>

          <USwitch
            v-model="draft.deleteBelowThreshold"
            label="Remove the post when reactions drop below the threshold"
          />

          <p
            v-if="draftError"
            class="flex items-start gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
          >
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
            {{ draftError }}
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="draft = null">Cancel</UButton>
          <UButton color="primary" :disabled="!!draftError" @click="commitDraft">
            {{ draftIsNew ? "Add board" : "Apply changes" }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ── Delete confirmation ── -->
    <UModal :open="!!deleteTarget" @update:open="(v: boolean) => !v && (deleteTarget = null)">
      <template #content>
        <div class="space-y-4 p-6">
          <div class="flex items-center gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-400/10 ring-1 ring-inset ring-red-400/30"
            >
              <UIcon name="i-lucide-triangle-alert" class="h-5 w-5 text-red-300" />
            </span>
            <div>
              <h3 class="text-base font-semibold text-white">Delete board</h3>
              <p class="text-[13px] text-gray-400">Applies when you save.</p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            Delete <strong class="text-white">{{ deleteTarget?.name || "this board" }}</strong>?
            Posts already in its channel are left as they are.
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton color="neutral" variant="ghost" @click="deleteTarget = null">Cancel</UButton>
            <UButton color="error" icon="i-lucide-trash-2" @click="confirmDelete">Delete board</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from "vue";
import {
  EMOJI_PRESETS,
  MAX_BOARDS,
  describeBoard,
  isCustomEmoji,
  newBoard,
  toSavedBoard,
  validateBoard,
  type BoardDraft,
} from "~/utils/starboard";

const route = useRoute();
const guildId = route.params.guild_id as string;
const { state, isModuleEnabled, saveModuleSettings, getModuleConfig, loadChannels, channelOptions } =
  useServerSettings(guildId);
const {
  leaderboard,
  loading: leaderboardLoading,
  error: leaderboardError,
  fetchLeaderboard,
} = useStarboardLeaderboard(guildId);

// Ignored/watched pickers also offer forum + media channels; fail soft to text-only.
const sourceOptions = ref<{ label: string; value: string }[] | null>(null);
const sourceChannelOptions = computed(() => sourceOptions.value ?? channelOptions.value);
const loadSourceChannels = async () => {
  try {
    const response = await $fetch<{ channels: { id: string; name: string }[] }>(
      "/api/discord/channels",
      { params: { guild_id: guildId, types: "text,forum" } },
    );
    sourceOptions.value = (response.channels || []).map((c) => ({
      label: `#${c.name}`,
      value: c.id,
    }));
  } catch (error) {
    console.error("Error loading source channels:", error);
  }
};

const saving = ref(false);
const settings = reactive<{ boards: BoardDraft[] }>({ boards: [] });

// Last loaded/saved values (JSON); drives the unsaved-changes bar and Discard.
const baseline = ref(JSON.stringify(settings));
const dirty = computed(() => JSON.stringify(settings) !== baseline.value);

const draft = ref<BoardDraft | null>(null);
const draftIsNew = ref(false);
const deleteTarget = ref<BoardDraft | null>(null);
const boardForLeaderboard = ref<BoardDraft | null>(null);

// `crypto.randomUUID` needs a secure context; LAN dashboards over plain HTTP may not have one.
function uid() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") return webCrypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const channelName = (channelId: string) =>
  state.value.channels.find((c) => c.id === channelId)?.name ?? "unknown-channel";

// ── Board editing ────────────────────────────────────────────────────

const draftError = computed(() =>
  draft.value
    ? validateBoard(
        draft.value,
        settings.boards.filter((b) => b.id !== draft.value!.id),
      )
    : null,
);

// Clearing the last watched channel turns vote reactions off (it would seed every channel).
watch(
  () => draft.value?.watchedChannelIds.length,
  (count) => {
    if (draft.value && count === 0) draft.value.autoReact = false;
  },
);

function openCreate() {
  draftIsNew.value = true;
  draft.value = newBoard(uid());
}

function openEdit(board: BoardDraft) {
  draftIsNew.value = false;
  draft.value = JSON.parse(JSON.stringify(board)) as BoardDraft;
}

function commitDraft() {
  if (!draft.value || draftError.value) return;
  const saved = toSavedBoard(draft.value);
  const idx = settings.boards.findIndex((b) => b.id === saved.id);
  if (idx === -1) settings.boards.push(saved);
  else settings.boards[idx] = saved;
  draft.value = null;
}

function confirmDelete() {
  if (deleteTarget.value) {
    settings.boards = settings.boards.filter((b) => b.id !== deleteTarget.value!.id);
  }
  deleteTarget.value = null;
}

function openLeaderboard(board: BoardDraft) {
  boardForLeaderboard.value = board;
  void fetchLeaderboard(board.id);
}

// ── Save ─────────────────────────────────────────────────────────────

const save = async () => {
  saving.value = true;
  const ok = await saveModuleSettings("starboard", {
    boards: settings.boards.map(toSavedBoard),
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) baseline.value = JSON.stringify(settings);
  saving.value = false;
};

const discard = () => {
  const b = JSON.parse(baseline.value) as { boards: BoardDraft[] };
  settings.boards = b.boards;
};

// ── Init ─────────────────────────────────────────────────────────────

onMounted(async () => {
  const saved = getModuleConfig("starboard");
  if (saved?.boards && Array.isArray(saved.boards)) {
    settings.boards = saved.boards.map((b: any) => ({
      id: b.id ?? uid(),
      name: b.name ?? "Unnamed board",
      enabled: b.enabled ?? true,
      emoji: b.emoji ?? "⭐",
      threshold: Number.isInteger(b.threshold) ? b.threshold : 3,
      channelId: b.channelId ?? "",
      ignoredChannelIds: Array.isArray(b.ignoredChannelIds) ? b.ignoredChannelIds : [],
      watchedChannelIds: Array.isArray(b.watchedChannelIds) ? b.watchedChannelIds : [],
      autoReact: b.autoReact === true && Array.isArray(b.watchedChannelIds) && b.watchedChannelIds.length > 0,
      deleteBelowThreshold: b.deleteBelowThreshold ?? false,
    }));
  }
  baseline.value = JSON.stringify(settings);
  await Promise.all([loadChannels(), loadSourceChannels()]);
});
</script>
