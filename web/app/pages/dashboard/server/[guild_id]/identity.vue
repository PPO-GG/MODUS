<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-id-card"
      title="Bot Identity"
      description="Give the bot its own nickname and avatar in this server. Other servers keep the default."
    />

    <p
      v-if="errorMessage"
      class="flex items-start gap-2 rounded-xl bg-red-400/[0.06] px-4 py-3 text-sm text-red-200 ring-1 ring-inset ring-red-400/25"
      role="alert"
    >
      <UIcon name="i-lucide-circle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
      {{ errorMessage }}
    </p>

    <div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div class="min-w-0 space-y-6">
        <DashboardModuleSection
          title="Identity"
          description="Applied to Discord when you save, and only in this server."
        >
          <div class="space-y-6">
            <!-- Avatar -->
            <div>
              <p class="mb-2 text-sm font-medium text-white">Avatar</p>
              <div
                class="flex flex-wrap items-center gap-4 rounded-xl border border-dashed p-4 transition-colors"
                :class="dragging ? 'border-teal-300/60 bg-teal-300/[0.05]' : 'border-white/10'"
                @dragover.prevent="dragging = true"
                @dragleave.prevent="dragging = false"
                @drop.prevent="onDrop"
              >
                <UAvatar
                  :src="avatarSrc"
                  :alt="nickname || 'Bot avatar'"
                  size="3xl"
                />
                <div class="min-w-0 space-y-2">
                  <div class="flex flex-wrap gap-2">
                    <UButton
                      color="neutral"
                      variant="soft"
                      size="sm"
                      icon="i-lucide-upload"
                      :loading="uploading"
                      @click="avatarInput?.click()"
                    >
                      {{ avatarImage ? "Replace" : "Upload" }}
                    </UButton>
                    <UButton
                      v-if="avatarImage"
                      color="error"
                      variant="ghost"
                      size="sm"
                      icon="i-lucide-trash-2"
                      @click="clearAvatar"
                    >
                      Remove
                    </UButton>
                  </div>
                  <p class="text-[13px] text-gray-400">
                    Drop an image here or upload one. PNG, JPG or GIF, up to 8 MB.
                  </p>
                </div>
                <input
                  ref="avatarInput"
                  type="file"
                  accept="image/*"
                  class="sr-only"
                  aria-label="Upload avatar image"
                  @change="onFileInput"
                />
              </div>
            </div>

            <!-- Nickname -->
            <UFormField label="Nickname" class="w-full">
              <template #hint>
                <span class="text-xs tabular-nums text-gray-400">{{ nickname.length }}/32</span>
              </template>
              <div class="flex flex-wrap items-center gap-2">
                <UInput
                  v-model="nickname"
                  placeholder="Leave blank to use the bot's default name"
                  :maxlength="32"
                  icon="i-lucide-user-round-pen"
                  class="w-full sm:max-w-sm"
                />
                <UButton
                  v-if="nickname"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="nickname = ''"
                >
                  Use default name
                </UButton>
              </div>
            </UFormField>
          </div>
        </DashboardModuleSection>

        <DashboardModuleSection
          title="Troubleshooting"
          description="If the bot looks different in Discord than it does here, push the values shown on this page again."
        >
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-rotate-cw"
            :loading="forceSaving"
            @click="forceReapply"
          >
            Force re-apply
          </UButton>
          <p class="mt-2 text-[13px] text-gray-400">
            This resends the nickname and avatar even when nothing changed, for example after the
            bot was removed from the server and added back.
          </p>
        </DashboardModuleSection>
      </div>

      <!-- Preview -->
      <DashboardModuleSection
        title="Preview"
        description="How the bot appears in a message in this server."
        class="xl:sticky xl:top-6"
      >
        <div class="flex gap-3 rounded-lg bg-[#313338] p-4">
          <UAvatar
            :src="avatarSrc"
            :alt="previewName"
            size="lg"
            class="shrink-0"
          />
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex flex-wrap items-center gap-x-1.5">
              <span class="text-sm font-medium text-white">{{ previewName }}</span>
              <span class="rounded bg-indigo-500 px-1 text-[10px] font-semibold leading-4 text-white">APP</span>
              <span class="text-[11px] text-gray-400">Today at {{ previewTime }}</span>
            </div>
            <p class="text-sm text-[#dbdee1]">Welcome aboard! This is how I look in this server.</p>
          </div>
        </div>
        <p v-if="!nickname.trim()" class="mt-2 text-[13px] text-gray-400">
          With no nickname the bot shows its default name.
        </p>
      </DashboardModuleSection>
    </div>

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

const route = useRoute();
const guildId = route.params.guild_id as string;
const toast = useToast();

const DEFAULT_BOT_NAME = "MODUS";

const nickname = ref("");
const avatarImage = ref<string | null>(null);
const avatarPreview = ref<string | null>(null);
const avatarInput = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
const uploading = ref(false);
const saving = ref(false);
const forceSaving = ref(false);
const errorMessage = ref("");

// What Discord currently has (as of the last successful load or save).
const savedNickname = ref<string | null>(null);
const savedAvatarImage = ref<string | null>(null);

const dirty = computed(
  () =>
    (nickname.value.trim() || null) !== savedNickname.value ||
    avatarImage.value !== savedAvatarImage.value,
);

const previewName = computed(() => nickname.value.trim() || DEFAULT_BOT_NAME);
const avatarSrc = computed(() => avatarPreview.value || "/modus.svg");
const previewTime = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

async function load() {
  try {
    const cfg = await $fetch<{ enabled: boolean; settings: Record<string, any> }>(
      `/api/guild-configs/${encodeURIComponent(guildId)}/identity`,
    );
    nickname.value = cfg.settings?.nickname ?? "";
    avatarImage.value = cfg.settings?.avatarImage ?? null;
    avatarPreview.value = avatarImage.value;
    savedNickname.value = cfg.settings?.nickname ?? null;
    savedAvatarImage.value = cfg.settings?.avatarImage ?? null;
  } catch (err: any) {
    console.error("[Identity] load error:", err);
    errorMessage.value = "Failed to load current identity settings.";
  }
}

async function uploadAvatar(file: File) {
  // Guard flag to prevent late FileReader.onload from overwriting error rollback
  let isCurrentUpload = true;

  const reader = new FileReader();
  reader.onload = (e) => {
    // Only update preview if this upload attempt is still active
    if (isCurrentUpload) {
      avatarPreview.value = (e.target?.result as string) || null;
    }
  };
  reader.readAsDataURL(file);

  uploading.value = true;
  errorMessage.value = "";
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("guild_id", guildId);
    const res = await fetch("/api/identity/upload-avatar", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.statusMessage || "Upload failed");
    }
    const { url } = await res.json();
    avatarImage.value = url;
    toast.add({
      title: "Avatar uploaded",
      description: "Remember to hit Save to apply it.",
      color: "success",
    });
  } catch (err: any) {
    // Mark upload as handled so late FileReader.onload won't overwrite rollback
    isCurrentUpload = false;
    errorMessage.value = err?.message || "Could not upload image.";
    avatarPreview.value = avatarImage.value;
  } finally {
    uploading.value = false;
  }
}

async function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  try {
    if (file) await uploadAvatar(file);
  } finally {
    input.value = "";
  }
}

async function onDrop(event: DragEvent) {
  dragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    errorMessage.value = "That file isn't an image.";
    return;
  }
  await uploadAvatar(file);
}

function clearAvatar() {
  avatarImage.value = null;
  avatarPreview.value = null;
}

function discard() {
  nickname.value = savedNickname.value ?? "";
  avatarImage.value = savedAvatarImage.value;
  avatarPreview.value = savedAvatarImage.value;
  errorMessage.value = "";
}

/**
 * Shared save path for both the normal Save button and "Force re-apply".
 *
 * `force: true` tells the apply endpoint to skip its diff-against-stored
 * comparison and always push the currently-displayed values to Discord —
 * the escape hatch for when the stored guild_configs row has drifted from
 * what's actually live (e.g. after a guild un-registers and re-registers,
 * which wipes the identity row but never touches Discord itself).
 */
async function performSave(force: boolean, loadingFlag: { value: boolean }) {
  if (uploading.value) {
    toast.add({
      title: "Upload in progress",
      description: "Wait for the avatar to finish uploading, then save.",
      color: "warning",
    });
    return;
  }
  loadingFlag.value = true;
  errorMessage.value = "";
  try {
    await $fetch(`/api/identity/${encodeURIComponent(guildId)}`, {
      method: "PUT",
      body: {
        nickname: nickname.value.trim() || null,
        avatarImage: avatarImage.value,
        ...(force ? { force: true } : {}),
      },
    });
    savedNickname.value = nickname.value.trim() || null;
    savedAvatarImage.value = avatarImage.value;
    toast.add({
      title: "Saved!",
      description: force
        ? "Bot identity re-applied to Discord for this server."
        : "Bot identity updated for this server.",
      color: "success",
    });
  } catch (err: any) {
    errorMessage.value = err?.data?.statusMessage || err?.message || "Failed to save.";
    // Roll back to the last known-applied values on failure so the form
    // doesn't show a state that Discord actually rejected.
    nickname.value = savedNickname.value || "";
    avatarImage.value = savedAvatarImage.value;
    avatarPreview.value = savedAvatarImage.value;
  } finally {
    loadingFlag.value = false;
  }
}

async function save() {
  await performSave(false, saving);
}

async function forceReapply() {
  await performSave(true, forceSaving);
}

onBeforeRouteLeave(() => {
  if (dirty.value && !window.confirm("You have unsaved identity changes. Leave anyway?")) {
    return false;
  }
});

onMounted(load);
</script>
