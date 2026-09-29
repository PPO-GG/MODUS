<template>
  <div
    :class="
      activeTab === 'image'
        ? 'flex h-full flex-col gap-4 p-4 md:p-6'
        : 'mx-auto max-w-6xl space-y-6'
    "
  >
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-party-popper"
      title="Welcome"
      description="Greet new members with a custom image, a message, or both."
      :enabled="isModuleEnabled('welcome')"
    />

    <!-- ── Tabs ── -->
    <div
      class="inline-flex self-start rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-white/10"
      role="tablist"
      aria-label="Welcome sections"
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
        @click="selectTab(tab.value)"
      >
        <UIcon :name="tab.icon" class="h-4 w-4" />
        {{ tab.label }}
        <span
          v-if="tab.value === 'image' ? imageDirty : messageDirty"
          class="h-1.5 w-1.5 rounded-full bg-amber-400"
          aria-label="Unsaved changes"
        />
      </button>
    </div>

    <!-- ── Image designer ── -->
    <CanvasEditor
      v-if="activeTab === 'image' && !loading"
      :key="editorKey"
      :model-value="template"
      :guild-id="guildId"
      :profile="welcomeProfile"
      class="min-h-0 flex-1"
    />

    <div
      v-else-if="activeTab === 'message'"
      class="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]"
    >
      <!-- ══════════════ Settings ══════════════ -->
      <div class="min-w-0 space-y-6">
        <div v-if="loading" class="space-y-6" aria-busy="true">
          <div v-for="n in 3" :key="n" class="h-40 animate-pulse rounded-xl bg-white/[0.04]" />
        </div>

        <template v-else>
          <DashboardModuleSection title="Channel" description="Where welcome messages are posted.">
            <USelectMenu
              v-model="channelId"
              :items="channelOptions"
              value-key="value"
              placeholder="Select a channel"
              icon="i-lucide-hash"
              :loading="state.channelsLoading"
              class="w-full"
              aria-label="Welcome channel"
            />
            <p
              v-if="channelProblem"
              class="mt-3 flex items-start gap-2 rounded-lg bg-amber-400/[0.06] px-3 py-2 text-[13px] text-amber-200 ring-1 ring-inset ring-amber-400/25"
              role="status"
            >
              <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
              {{ channelProblem }}
            </p>
          </DashboardModuleSection>

          <DashboardModuleSection title="What to send" description="Members get a picture, a message, or both.">
            <div class="space-y-4">
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="What to send">
                <label v-for="opt in modeCards" :key="opt.value" class="block cursor-pointer">
                  <input
                    v-model="message.mode"
                    type="radio"
                    name="welcome-mode"
                    :value="opt.value"
                    class="peer sr-only"
                  />
                  <div
                    class="flex h-full items-start gap-3 rounded-xl p-3.5 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-checked:bg-sky-200/[0.06] peer-checked:ring-2 peer-checked:ring-teal-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
                  >
                    <span
                      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-200/10 text-sky-200"
                    >
                      <UIcon :name="opt.icon" class="h-4 w-4" />
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="flex items-center justify-between gap-2">
                        <span class="text-sm font-semibold text-white">{{ opt.label }}</span>
                        <UIcon
                          v-if="message.mode === opt.value"
                          name="i-lucide-circle-check"
                          class="h-4 w-4 shrink-0 text-teal-300"
                        />
                      </span>
                      <span class="block text-[13px] text-gray-400">{{ opt.description }}</span>
                    </span>
                  </div>
                </label>
              </div>

              <div v-if="message.mode === 'both'">
                <p class="mb-2 text-sm font-medium text-white">Order</p>
                <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Order">
                  <label v-for="opt in WELCOME_MESSAGE_ORDERS" :key="opt.value" class="cursor-pointer">
                    <input
                      v-model="message.order"
                      type="radio"
                      name="welcome-order"
                      :value="opt.value"
                      class="peer sr-only"
                    />
                    <span
                      class="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-checked:bg-sky-200/[0.06] peer-checked:text-white peer-checked:ring-2 peer-checked:ring-teal-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
                    >
                      <UIcon :name="opt.lucide" class="h-4 w-4" />
                      {{ opt.label }}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </DashboardModuleSection>

          <DashboardModuleSection
            v-if="message.mode !== 'image'"
            title="Message"
            description="The text posted for each new member."
          >
            <div class="space-y-4">
              <UFormField label="Title" hint="Optional" class="w-full">
                <UInput v-model="message.title" :maxlength="256" placeholder="Welcome!" class="w-full" />
              </UFormField>

              <div>
                <label for="welcome-body" class="mb-1.5 block text-sm font-medium text-white">Text</label>
                <MarkdownToolbar v-model="message.body" :target="bodyRef" />
                <textarea
                  id="welcome-body"
                  ref="bodyRef"
                  v-model="message.body"
                  :maxlength="2000"
                  rows="6"
                  placeholder="Welcome to **{server_name}**, {user}! 🎉"
                  class="block w-full resize-y rounded-b-xl border border-white/10 bg-gray-950/60 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-teal-300/60 focus:outline-none"
                />
                <div class="mt-1.5 text-right text-xs tabular-nums text-gray-400">
                  {{ message.body.length }}/2000
                </div>
              </div>

              <div>
                <p class="mb-2 text-sm font-medium text-white">Insert a placeholder</p>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    v-for="ph in placeholderInfo"
                    :key="ph.token"
                    type="button"
                    class="flex items-center gap-3 rounded-lg px-3 py-2 text-left ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-teal-300"
                    @click="insertPlaceholder(ph.token)"
                  >
                    <code class="shrink-0 font-mono text-xs text-teal-300">{{ ph.token }}</code>
                    <span class="min-w-0 text-[13px] text-gray-400">{{ ph.meaning }}</span>
                  </button>
                </div>
              </div>
            </div>
          </DashboardModuleSection>

          <DashboardModuleSection
            title="Accent color"
            description="The stripe down the side of the message. Leave it off for the default gray."
          >
            <div class="flex flex-wrap items-center gap-3">
              <label class="flex cursor-pointer items-center gap-2 text-sm text-white">
                <USwitch
                  :model-value="message.accentColor !== null"
                  aria-label="Use an accent color"
                  @update:model-value="message.accentColor = $event ? ACCENT_PRESETS[0]! : null"
                />
                {{ message.accentColor !== null ? "On" : "Off" }}
              </label>

              <template v-if="message.accentColor !== null">
                <div class="flex items-center gap-1.5" role="group" aria-label="Accent color presets">
                  <button
                    v-for="color in ACCENT_PRESETS"
                    :key="color"
                    type="button"
                    class="h-7 w-7 rounded-full ring-1 ring-inset ring-white/20 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
                    :class="
                      message.accentColor?.toLowerCase() === color ? '!ring-2 !ring-white' : ''
                    "
                    :style="{ backgroundColor: color }"
                    :aria-label="`Use ${color}`"
                    :aria-pressed="message.accentColor?.toLowerCase() === color"
                    @click="message.accentColor = color"
                  />
                </div>
                <UPopover>
                  <UButton
                    color="neutral"
                    variant="outline"
                    size="sm"
                    icon="i-lucide-pipette"
                    aria-label="Pick a custom color"
                  >
                    Custom
                  </UButton>
                  <template #content>
                    <div class="p-3">
                      <UColorPicker v-model="message.accentColor" size="sm" />
                    </div>
                  </template>
                </UPopover>
                <UInput
                  v-model="message.accentColor"
                  size="sm"
                  class="w-28 font-mono"
                  aria-label="Accent color hex code"
                  :color="accentValid ? undefined : 'error'"
                />
              </template>
            </div>
            <p v-if="!accentValid" class="mt-2 text-[13px] text-red-300" role="alert">
              Use a full hex color like #a78bfa.
            </p>
          </DashboardModuleSection>

          <DashboardModuleSection
            title="Welcome image"
            :description="
              message.mode === 'text'
                ? 'Text only is selected, so no image is sent. You can still design one and switch back later.'
                : 'The picture members get. Design it in the Image tab: background, their avatar, text and other layers.'
            "
          >
            <template #actions>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-pencil-ruler"
                @click="selectTab('image')"
              >
                Design image
              </UButton>
            </template>
            <DashboardWelcomePreviewImage
              :src="imageUrl"
              class="max-w-[520px]"
              :class="{ 'opacity-50': message.mode === 'text' }"
              @edit="selectTab('image')"
            />
          </DashboardModuleSection>

          <DashboardModuleAccessSection :guild-id="guildId" module-name="welcome" />
        </template>
      </div>

      <!-- ══════════════ Preview ══════════════ -->
      <DashboardModuleSection
        title="Preview"
        description="How it looks when someone joins. The image shows the last saved design."
        class="xl:sticky xl:top-6"
      >
        <div class="flex gap-3 rounded-lg bg-[#313338] p-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-500">
            <UIcon name="i-lucide-bot" class="h-5 w-5 text-white" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex flex-wrap items-center gap-x-1.5">
              <span class="text-sm font-medium text-white">MODUS</span>
              <span class="rounded bg-indigo-500 px-1 text-[10px] font-semibold leading-4 text-white">APP</span>
              <span class="text-[11px] text-gray-400">Today at {{ previewTime }}</span>
            </div>

            <div v-if="!hasText && !showImage" class="text-sm italic text-gray-400">
              Nothing will be sent. Add some text, or switch to Image or Both.
            </div>

            <template v-else>
              <!-- Mentions inside embeds don't notify, so the bot pings above it -->
              <div
                v-if="parts.pingsMember"
                class="discord-md mb-1 text-sm text-[#dbdee1]"
                v-html="renderMd(`<@${previewUserId}>`)"
              />

              <!-- Image first (or image only): a plain attachment above the embed -->
              <DashboardWelcomePreviewImage
                v-if="showImage && (!hasText || message.order === 'image-first')"
                :src="imageUrl"
                @edit="selectTab('image')"
                class="mb-2 max-w-[520px]"
              />

              <div
                v-if="hasText"
                class="max-w-[432px] space-y-2 rounded border-l-4 bg-[#2b2d31] px-4 py-3"
                :style="{ borderLeftColor: previewAccent }"
              >
                <div
                  v-if="parts.title"
                  class="discord-md break-words text-base font-semibold text-white"
                  v-html="renderMd(parts.title)"
                />
                <div
                  v-if="parts.body"
                  class="discord-md whitespace-pre-wrap break-words text-sm text-[#dbdee1]"
                  v-html="renderMd(parts.body)"
                />
                <!-- Text first: the image sits inside the embed, at the bottom -->
                <DashboardWelcomePreviewImage
                  v-if="showImage && message.order === 'text-first'"
                  :src="imageUrl"
                  @edit="selectTab('image')"
                  class="!mt-3"
                />
              </div>
            </template>
          </div>
        </div>
      </DashboardModuleSection>
    </div>

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import CanvasEditor from "~/components/CanvasEditor.vue";
import { MAX_IMAGE_LAYERS, imageLayerCount } from "~/utils/canvas-editor/elements";
import { welcomeProfile } from "~/utils/canvas-editor/profiles/welcome";
import type { CanvasTemplate } from "~/utils/canvas-editor/types";
import { renderDiscordMarkdown } from "~/utils/discord-markdown";
import {
  WELCOME_MESSAGE_ORDERS as ORDERS,
  normalizeWelcomeMessage,
  welcomeMessageParts,
  type WelcomeMessage,
} from "~/utils/welcome-message";

const route = useRoute();
const guildId = route.params.guild_id as string;
const toast = useToast();
const { user } = useUserSession();
const { state, isModuleEnabled, saveModuleSettings, loadChannels, loadRoles, channelOptions } =
  useServerSettings(guildId);

const settingsUrl = `/api/guild-configs/${encodeURIComponent(guildId)}/welcome`;

const loading = ref(true);
const saving = ref(false);
// A failed load leaves defaults in place; saving them would overwrite the stored design.
const loadFailed = ref(false);
const channelId = ref<string | undefined>(undefined);
const message = ref<WelcomeMessage>(normalizeWelcomeMessage(undefined));
const savedSnapshot = ref("");
const bodyRef = ref<HTMLTextAreaElement | null>(null);

// Only these keys belong to the image designer; channel and message are the form's.
const CANVAS_KEYS = ["canvasWidth", "canvasHeight", "backgroundColor", "backgroundImage", "elements"] as const;

// The editor mutates this object in place, so it must stay the same reactive
// object while mounted (only load and Discard replace it, and Discard remounts).
const template = ref<CanvasTemplate>(welcomeProfile.defaultTemplate());
const editorKey = ref(0);

const pickCanvas = (settings: Record<string, any>): Partial<CanvasTemplate> =>
  Object.fromEntries(CANVAS_KEYS.filter((k) => k in settings).map((k) => [k, settings[k]]));

// Every canvas key, even unset ones: an absent backgroundImage must override
// (and so clear) the saved one when merged, e.g. after Reset.
const canvasPatch = (t: CanvasTemplate): Record<string, unknown> =>
  Object.fromEntries(CANVAS_KEYS.map((k) => [k, t[k]]));

// ── Static option data ──
const modeCards = [
  { value: "image", label: "Image", icon: "i-lucide-image", description: "Just the picture." },
  { value: "text", label: "Text", icon: "i-lucide-message-square-text", description: "Just the message." },
  { value: "both", label: "Image and text", icon: "i-lucide-layout-list", description: "Both, in the order you pick." },
] as const;

// Same options as the shared util, with lucide icons.
const WELCOME_MESSAGE_ORDERS = ORDERS.map((o) => ({
  ...o,
  lucide: o.value === "text-first" ? "i-lucide-align-left" : "i-lucide-image",
}));

const placeholderInfo = [
  { token: "{user}", meaning: "Mentions the new member" },
  { token: "{username}", meaning: "Their Discord username" },
  { token: "{displayname}", meaning: "Their display name" },
  { token: "{server_name}", meaning: "This server's name" },
  { token: "{member_count}", meaning: "Members in the server" },
];

const ACCENT_PRESETS = ["#a78bfa", "#5eead4", "#7dd3fc", "#f472b6", "#fbbf24", "#34d399", "#f87171"];

// ── Dirty tracking ──
const snapshot = () =>
  JSON.stringify({
    channelId: channelId.value ?? null,
    message: message.value,
    canvas: canvasPatch(template.value),
  });
const dirty = computed(() => !loading.value && snapshot() !== savedSnapshot.value);

// Per-tab dots, compared against the saved snapshot.
const savedParts = computed(() => (savedSnapshot.value ? JSON.parse(savedSnapshot.value) : null));
const messageDirty = computed(
  () =>
    !loading.value &&
    !!savedParts.value &&
    JSON.stringify({ channelId: channelId.value ?? null, message: message.value }) !==
      JSON.stringify({ channelId: savedParts.value.channelId, message: savedParts.value.message }),
);
const imageDirty = computed(
  () =>
    !loading.value &&
    !!savedParts.value &&
    JSON.stringify(canvasPatch(template.value)) !== JSON.stringify(savedParts.value.canvas),
);

// The bot only accepts a full #rrggbb value here.
const accentValid = computed(
  () => message.value.accentColor === null || /^#[0-9a-fA-F]{6}$/.test(message.value.accentColor),
);
const previewAccent = computed(() =>
  message.value.accentColor && accentValid.value ? message.value.accentColor : "#1e1f22",
);

const channelProblem = computed(() => {
  if (!channelId.value) {
    return isModuleEnabled("welcome")
      ? "No channel is selected, so nothing is posted when someone joins."
      : "";
  }
  if (state.value.channelsLoading || state.value.channels.length === 0) return "";
  return channelOptions.value.some((c) => c.value === channelId.value)
    ? ""
    : "The saved channel no longer exists. Pick another one.";
});

async function fetchSettings() {
  const cfg = await $fetch<{ settings: Record<string, any> | null }>(settingsUrl);
  return cfg.settings ?? {};
}

async function load() {
  loading.value = true;
  loadFailed.value = false;
  try {
    const settings = await fetchSettings();
    channelId.value = settings.channelId || undefined;
    message.value = normalizeWelcomeMessage(settings.message);
    if (Object.keys(settings).length > 0) {
      template.value = { ...welcomeProfile.defaultTemplate(), ...pickCanvas(settings) };
    }
  } catch (err) {
    loadFailed.value = true;
    console.error("[Welcome] load error:", err);
    toast.add({ title: "Error", description: "Failed to load welcome settings.", color: "error" });
  } finally {
    savedSnapshot.value = snapshot();
    loading.value = false;
  }
}

async function save() {
  if (loadFailed.value) {
    toast.add({
      title: "Couldn't load your saved settings",
      description: "Reload the page before saving so your existing welcome design isn't overwritten.",
      color: "error",
    });
    return;
  }
  if (imageLayerCount(template.value.elements) > MAX_IMAGE_LAYERS) {
    toast.add({
      title: "Image layer limit reached",
      description: `A ${welcomeProfile.noun} can contain up to ${MAX_IMAGE_LAYERS} images.`,
      color: "error",
    });
    return;
  }
  if (!accentValid.value) {
    toast.add({
      title: "Check the accent color",
      description: "Use a full hex color like #a78bfa.",
      color: "error",
    });
    return;
  }
  saving.value = true;
  try {
    // Saving replaces the whole settings row, so merge over the latest saved
    // settings to keep any keys this page doesn't know about.
    const current = await fetchSettings();
    const ok = await saveModuleSettings("welcome", {
      ...current,
      ...canvasPatch(template.value),
      channelId: channelId.value,
      message: message.value,
    });
    // A failed save keeps the form dirty so the bar stays and Save can retry.
    if (ok) {
      savedSnapshot.value = snapshot();
      onImageSaved();
    }
  } catch (err) {
    console.error("[Welcome] save error:", err);
    toast.add({ title: "Error", description: "Failed to save.", color: "error" });
  } finally {
    saving.value = false;
  }
}

function discard() {
  const saved = JSON.parse(savedSnapshot.value);
  channelId.value = saved.channelId ?? undefined;
  message.value = saved.message;
  template.value = { ...welcomeProfile.defaultTemplate(), ...saved.canvas };
  editorKey.value++;
}

function insertPlaceholder(placeholder: string) {
  const el = bodyRef.value;
  const body = message.value.body;
  const start = el?.selectionStart ?? body.length;
  const end = el?.selectionEnd ?? body.length;
  message.value.body = body.slice(0, start) + placeholder + body.slice(end);
  nextTick(() => {
    el?.focus();
    el?.setSelectionRange(start + placeholder.length, start + placeholder.length);
  });
}

// ── Preview ──
const displayName = computed(
  () => user.value?.globalName || user.value?.username || "New Member",
);

const previewUserId = computed(() => user.value?.id ?? "0");

const parts = computed(() =>
  welcomeMessageParts(message.value, {
    userId: previewUserId.value,
    username: user.value?.username ?? "newmember",
    displayName: displayName.value,
    serverName: state.value.guild?.name ?? "this server",
    memberCount: 1234,
  }),
);

const hasText = computed(() => Boolean(parts.value.title || parts.value.body));

const markdownContext = computed(() => ({
  channels: state.value.channels.map((c) => ({ id: c.id, name: c.name })),
  roles: state.value.roles.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : null,
  })),
  users: user.value ? [{ id: user.value.id, name: displayName.value }] : [],
}));

const renderMd = (text: string) => renderDiscordMarkdown(text, markdownContext.value);

const showImage = computed(() => message.value.mode !== "text");

// Refreshed after a save, since the image design may have changed.
const imageUrl = ref(previewImageUrl());
function previewImageUrl() {
  return `/api/welcome/preview/${encodeURIComponent(guildId)}?t=${Date.now()}`;
}
const onImageSaved = () => {
  imageUrl.value = previewImageUrl();
};

const previewTime = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

// ── Tabs ──
const tabs = [
  { value: "message", label: "Message", icon: "i-lucide-message-square-text" },
  { value: "image", label: "Image", icon: "i-lucide-image" },
] as const;
type TabValue = (typeof tabs)[number]["value"];

const router = useRouter();
const { setFullBleed, reset: resetPageChrome } = usePageChrome();
const activeTab = ref<TabValue>(route.query.tab === "image" ? "image" : "message");

// Both tabs share one dirty state and one save bar, so switching never needs a confirm.
function selectTab(tab: TabValue) {
  activeTab.value = tab;
}

watch(
  activeTab,
  (tab) => {
    // The designer fills the page, like the XP rank card tab.
    if (tab === "image") setFullBleed(true);
    else resetPageChrome();
    router.replace({ query: tab === "image" ? { tab } : {} });
  },
  { immediate: true },
);

onUnmounted(resetPageChrome);

onBeforeRouteLeave(() => {
  if (dirty.value && !window.confirm("You have unsaved welcome changes. Leave anyway?")) {
    return false;
  }
});

onMounted(() => {
  loadChannels();
  loadRoles();
  load();
});
</script>
