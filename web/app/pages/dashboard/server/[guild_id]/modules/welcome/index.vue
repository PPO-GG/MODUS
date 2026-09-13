<template>
  <div class="p-6 lg:p-8 space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <NuxtLink
        :to="`/dashboard/server/${guildId}/modules`"
        class="w-9 h-9 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center shrink-0"
      >
        <UIcon name="i-heroicons-arrow-left" class="w-5 h-5 text-gray-400" />
      </NuxtLink>
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0"
        >
          <UIcon name="i-lucide-party-popper" class="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h2 class="text-xl font-bold text-white">Welcome</h2>
          <p class="text-xs text-gray-500">
            Greet new members with a custom image, text, or both
          </p>
        </div>
      </div>
      <UBadge
        :color="isModuleEnabled('welcome') ? 'success' : 'neutral'"
        variant="soft"
        class="ml-auto"
      >
        {{ isModuleEnabled("welcome") ? "Module Active" : "Module Disabled" }}
      </UBadge>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <!-- Settings -->
      <div
        class="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/90 to-gray-950/90 backdrop-blur-xl p-5"
      >
        <div
          class="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none"
        />
        <div class="relative space-y-5">
          <div class="flex items-center gap-2 mb-1">
            <div
              class="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0"
            >
              <UIcon name="i-heroicons-adjustments-horizontal" class="text-purple-400" />
            </div>
            <div>
              <h3 class="font-semibold text-white">Message</h3>
              <p class="text-[10px] text-gray-500">
                Where the welcome goes and what it contains
              </p>
            </div>
          </div>

          <div v-if="loading" class="space-y-4">
            <USkeleton v-for="n in 4" :key="n" class="h-10 w-full" />
          </div>

          <div v-else class="space-y-4">
            <UFormField label="Channel" description="Where welcome messages are posted.">
              <USelectMenu
                v-model="channelId"
                :items="channelOptions"
                value-key="value"
                placeholder="Select a channel"
                icon="i-heroicons-hashtag"
                :loading="state.channelsLoading"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Send">
              <UFieldGroup class="w-full">
                <UButton
                  v-for="opt in WELCOME_MESSAGE_MODES"
                  :key="opt.value"
                  :label="opt.label"
                  :color="message.mode === opt.value ? 'primary' : 'neutral'"
                  :variant="message.mode === opt.value ? 'solid' : 'outline'"
                  class="flex-1 justify-center"
                  @click="message.mode = opt.value"
                />
              </UFieldGroup>
            </UFormField>

            <UFormField v-if="message.mode === 'both'" label="Order">
              <UFieldGroup class="w-full">
                <UButton
                  v-for="opt in WELCOME_MESSAGE_ORDERS"
                  :key="opt.value"
                  :label="opt.label"
                  :icon="opt.icon"
                  :color="message.order === opt.value ? 'primary' : 'neutral'"
                  :variant="message.order === opt.value ? 'solid' : 'outline'"
                  class="flex-1 justify-center"
                  @click="message.order = opt.value"
                />
              </UFieldGroup>
            </UFormField>

            <template v-if="message.mode !== 'image'">
              <UFormField label="Title">
                <UInput
                  v-model="message.title"
                  :maxlength="256"
                  placeholder="Optional heading"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Text">
                <MarkdownToolbar v-model="message.body" :target="bodyRef" />
                <textarea
                  ref="bodyRef"
                  v-model="message.body"
                  :maxlength="2000"
                  rows="6"
                  placeholder="Welcome to **{server_name}**, {user}! 🎉"
                  class="block w-full rounded-b-xl border border-white/10 bg-gray-950/60 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-primary-500/60 resize-y"
                />
                <div class="flex items-start justify-between gap-2 mt-1.5">
                  <div class="flex flex-wrap gap-1">
                    <button
                      v-for="ph in WELCOME_PLACEHOLDERS"
                      :key="ph"
                      type="button"
                      class="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[11px] font-mono text-gray-400 hover:text-gray-200 transition-colors"
                      @click="insertPlaceholder(ph)"
                    >
                      {{ ph }}
                    </button>
                  </div>
                  <span class="text-[11px] text-gray-600 tabular-nums shrink-0">
                    {{ message.body.length }}/2000
                  </span>
                </div>
              </UFormField>
            </template>

            <UFormField label="Accent color">
              <div class="flex items-center gap-3">
                <USwitch
                  :model-value="message.accentColor !== null"
                  @update:model-value="message.accentColor = $event ? '#a78bfa' : null"
                />
                <template v-if="message.accentColor !== null">
                  <UPopover>
                    <button
                      type="button"
                      class="w-7 h-7 rounded-md border border-white/20"
                      :style="{ backgroundColor: message.accentColor }"
                      aria-label="Pick accent color"
                    />
                    <template #content>
                      <div class="p-3">
                        <UColorPicker v-model="message.accentColor" size="sm" />
                      </div>
                    </template>
                  </UPopover>
                  <UInput
                    v-model="message.accentColor"
                    size="sm"
                    class="font-mono w-28"
                  />
                </template>
              </div>
            </UFormField>
          </div>

          <div class="flex items-center justify-end gap-3 pt-2 border-t border-white/5">
            <span v-if="dirty" class="text-xs text-amber-400/80">Unsaved changes</span>
            <UButton
              icon="i-heroicons-cloud-arrow-up"
              label="Save"
              color="primary"
              :loading="saving"
              :disabled="loading || saving || !dirty"
              @click="save"
            />
          </div>
        </div>
      </div>

      <!-- Preview -->
      <div
        class="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-gray-900/90 to-gray-950/90 backdrop-blur-xl p-5 xl:sticky xl:top-6"
      >
        <div class="relative space-y-4">
          <div class="flex items-center gap-2">
            <div
              class="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0"
            >
              <UIcon name="i-heroicons-eye" class="text-indigo-400" />
            </div>
            <div>
              <h3 class="font-semibold text-white">Preview</h3>
              <p class="text-[10px] text-gray-500">
                How it looks when you join. The image shows the last saved design.
              </p>
            </div>
          </div>

          <div class="bg-[#313338] rounded-lg p-4 flex gap-3">
            <div
              class="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center shrink-0"
            >
              <UIcon name="i-lucide-bot" class="w-5 h-5 text-white" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-1">
                <span class="text-sm font-medium text-white">MODUS</span>
                <span
                  class="px-1 rounded bg-indigo-500 text-[10px] font-semibold text-white leading-4"
                  >APP</span
                >
                <span class="text-[11px] text-gray-400">Today at {{ previewTime }}</span>
              </div>

              <div
                v-if="!previewText && !showImage"
                class="text-sm italic text-gray-500"
              >
                Nothing will be sent — add some text or switch to Image or Both.
              </div>

              <div
                v-else
                class="rounded-lg bg-[#2b2d31] border border-white/5 p-3 space-y-3 max-w-[520px]"
                :style="
                  message.accentColor
                    ? { borderLeft: `4px solid ${message.accentColor}` }
                    : undefined
                "
              >
                <template v-for="block in previewBlocks" :key="block">
                  <div
                    v-if="block === 'text'"
                    class="discord-md text-sm text-[#dbdee1] whitespace-pre-wrap break-words"
                    v-html="previewHtml"
                  />
                  <div
                    v-else
                    class="relative rounded-md overflow-hidden bg-black/20"
                    :class="{ 'aspect-[1024/500]': !imageLoaded }"
                  >
                    <img
                      v-if="!imageError"
                      :src="imageUrl"
                      alt="Welcome image preview"
                      class="block w-full h-auto"
                      :class="{ 'absolute inset-0 opacity-0': !imageLoaded }"
                      @load="imageLoaded = true"
                      @error="imageError = true"
                    />
                    <div
                      v-if="!imageLoaded"
                      class="absolute inset-0 flex items-center justify-center text-xs text-gray-500"
                    >
                      <span v-if="imageError">Couldn't render the preview image.</span>
                      <UIcon v-else name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin" />
                    </div>
                    <div class="absolute bottom-2 right-2">
                      <UButton
                        :to="`/dashboard/server/${guildId}/modules/welcome/editor`"
                        icon="i-heroicons-pencil-square"
                        label="Edit image"
                        color="neutral"
                        variant="solid"
                        size="sm"
                        class="shadow-lg"
                      />
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <UButton
            v-if="message.mode === 'text'"
            :to="`/dashboard/server/${guildId}/modules/welcome/editor`"
            icon="i-heroicons-pencil-square"
            label="Edit welcome image"
            color="neutral"
            variant="outline"
            size="sm"
          />
        </div>
      </div>
    </div>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="welcome" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { renderDiscordMarkdown } from "~/utils/discord-markdown";
import {
  WELCOME_MESSAGE_MODES,
  WELCOME_MESSAGE_ORDERS,
  WELCOME_PLACEHOLDERS,
  normalizeWelcomeMessage,
  welcomeMessageText,
  type WelcomeMessage,
} from "~/utils/welcome-message";

const route = useRoute();
const guildId = route.params.guild_id as string;
const toast = useToast();
const { user } = useUserSession();
const { state, isModuleEnabled, loadChannels, loadRoles, channelOptions } =
  useServerSettings(guildId);

const settingsUrl = `/api/guild-configs/${encodeURIComponent(guildId)}/welcome`;

const loading = ref(true);
const saving = ref(false);
const channelId = ref<string | undefined>(undefined);
const message = ref<WelcomeMessage>(normalizeWelcomeMessage(undefined));
const savedSnapshot = ref("");
const bodyRef = ref<HTMLTextAreaElement | null>(null);

const snapshot = () =>
  JSON.stringify({ channelId: channelId.value ?? null, message: message.value });
const dirty = computed(() => !loading.value && snapshot() !== savedSnapshot.value);

async function fetchSettings() {
  const cfg = await $fetch<{ settings: Record<string, any> | null }>(settingsUrl);
  return cfg.settings ?? {};
}

async function load() {
  loading.value = true;
  try {
    const settings = await fetchSettings();
    channelId.value = settings.channelId || undefined;
    message.value = normalizeWelcomeMessage(settings.message);
  } catch (err) {
    console.error("[Welcome] load error:", err);
    toast.add({ title: "Error", description: "Failed to load welcome settings.", color: "error" });
  } finally {
    savedSnapshot.value = snapshot();
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    // PUT replaces the whole settings blob, so merge over the latest saved
    // settings to keep the image design the editor page owns.
    const current = await fetchSettings();
    await $fetch(settingsUrl, {
      method: "PUT",
      body: {
        settings: { ...current, channelId: channelId.value, message: message.value },
      },
    });
    savedSnapshot.value = snapshot();
    toast.add({ title: "Saved!", description: "Welcome settings saved.", color: "success" });
  } catch (err) {
    console.error("[Welcome] save error:", err);
    toast.add({ title: "Error", description: "Failed to save.", color: "error" });
  } finally {
    saving.value = false;
  }
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

const previewText = computed(() =>
  welcomeMessageText(message.value, {
    userId: user.value?.id ?? "0",
    username: user.value?.username ?? "newmember",
    displayName: displayName.value,
    serverName: state.value.guild?.name ?? "this server",
    memberCount: 1234,
  }),
);

const previewHtml = computed(() =>
  renderDiscordMarkdown(previewText.value, {
    channels: state.value.channels.map((c) => ({ id: c.id, name: c.name })),
    roles: state.value.roles.map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : null,
    })),
    users: user.value ? [{ id: user.value.id, name: displayName.value }] : [],
  }),
);

const showImage = computed(() => message.value.mode !== "text");

const previewBlocks = computed<("text" | "image")[]>(() => {
  const blocks: ("text" | "image")[] = [];
  if (previewText.value) blocks.push("text");
  if (showImage.value) blocks.push("image");
  return message.value.order === "image-first" ? blocks.reverse() : blocks;
});

// Cache-bust once per visit so returning from the editor shows the new design.
const imageUrl = `/api/welcome/preview/${encodeURIComponent(guildId)}?t=${Date.now()}`;
const imageLoaded = ref(false);
const imageError = ref(false);

const previewTime = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

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
