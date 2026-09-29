<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-layout-template"
      title="Embed Builder"
      description="Build and send rich embed messages, or save them as presets and tags."
      :enabled="isModuleEnabled('embeds')"
    />

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <!-- ── Left: destination, editor, actions ── -->
      <div class="min-w-0 space-y-6">
        <DashboardModuleSection
          title="Destination"
          description="The channel the embed is sent to."
        >
          <template v-if="loadedFromPreset" #actions>
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-sky-200/10 px-2.5 py-1 text-xs text-sky-200 ring-1 ring-inset ring-sky-100/20"
            >
              <UIcon name="i-lucide-bookmark" class="h-3.5 w-3.5" />
              Editing preset: {{ loadedFromPreset }}
            </span>
          </template>

          <div v-if="channelsLoading" class="flex items-center gap-2 py-2 text-gray-400">
            <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
            <span class="text-sm">Loading channels…</span>
          </div>
          <p v-else-if="channels.length === 0" class="text-sm text-gray-400">
            No text channels found. Make sure the bot is in this server.
          </p>
          <USelectMenu
            v-else
            v-model="targetChannelId"
            :items="channelOptions"
            value-key="value"
            placeholder="Select a channel…"
            searchable
            icon="i-lucide-hash"
            class="w-full"
          />
        </DashboardModuleSection>

        <EmbedEditor v-model="embedForm" />

        <DashboardModuleSection
          title="Send or save"
          description="Post it now, or keep it to reuse later."
        >
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-rotate-cw"
              @click="resetEmbedForm"
            >
              {{ loadedFromPreset ? "Discard changes" : "Reset" }}
            </UButton>

            <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
              <UButton
                v-if="loadedFromPreset && editingPresetId"
                color="neutral"
                variant="soft"
                icon="i-lucide-check"
                :loading="savingPreset"
                @click="updateLoadedPreset"
              >
                Save changes
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-bookmark"
                :disabled="!hasAnyContent"
                @click="openSaveDialog('preset')"
              >
                Save as preset
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-tag"
                :disabled="!hasAnyContent"
                @click="openSaveDialog('tag')"
              >
                Save as tag
              </UButton>
              <UButton
                color="primary"
                icon="i-lucide-send"
                :loading="sendingEmbed"
                :disabled="!targetChannelId || !hasAnyContent"
                @click="sendEmbed"
              >
                Send embed
              </UButton>
            </div>
          </div>
        </DashboardModuleSection>
      </div>

      <!-- ── Right: live preview ── -->
      <div class="min-w-0 xl:sticky xl:top-0 xl:h-fit">
        <div class="mb-2 flex items-center justify-between gap-3">
          <span class="text-sm font-medium text-white">Preview</span>
          <span
            class="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-300 ring-1 ring-inset ring-emerald-400/25"
          >
            <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
            Live
          </span>
        </div>
        <EmbedPreview :form="embedForm" :context="mdContext" />
      </div>
    </div>

    <!-- ── Saved embeds (presets) ── -->
    <DashboardModuleSection
      title="Saved embeds"
      :description="
        presetsLoading
          ? 'Loading presets…'
          : `${presets.length} preset${presets.length !== 1 ? 's' : ''}. Presets are private to the dashboard.`
      "
    >
      <template v-if="!presetsLoading && presets.length > 0" #actions>
        <UButton
          icon="i-lucide-rotate-cw"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="fetchPresets"
        >
          Refresh
        </UButton>
      </template>

      <div v-if="presetsLoading" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        <div v-for="i in 3" :key="i" class="h-28 animate-pulse rounded-xl bg-white/[0.04]" />
      </div>

      <div
        v-else-if="presets.length === 0"
        class="flex flex-col items-center gap-2 rounded-lg border border-dashed border-white/10 px-6 py-8 text-center"
      >
        <UIcon name="i-lucide-bookmark" class="h-5 w-5 text-sky-200" />
        <p class="max-w-md text-[13px] text-gray-400">
          Nothing saved yet. Build an embed above and choose
          <span class="text-sky-200">Save as preset</span> to reload and tweak it later.
        </p>
      </div>

      <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="preset in presets"
          :key="preset.$id"
          class="relative flex flex-col overflow-hidden rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/10 transition-colors hover:ring-white/20"
        >
          <div
            class="absolute inset-x-0 top-0 h-1"
            :style="{ backgroundColor: presetColor(preset) }"
          />
          <p class="truncate font-mono text-sm font-medium text-white" :title="preset.name">
            {{ preset.name }}
          </p>
          <p class="mt-1 truncate text-[13px] text-gray-400" :title="presetSubtitle(preset)">
            {{ presetSubtitle(preset) }}
          </p>
          <p v-if="preset.description" class="mt-1 line-clamp-2 text-[13px] italic text-gray-500">
            {{ preset.description }}
          </p>
          <div class="mt-auto flex items-center gap-1 pt-3">
            <UButton
              icon="i-lucide-download"
              size="sm"
              variant="soft"
              color="primary"
              @click="loadPreset(preset)"
            >
              Load
            </UButton>
            <UButton
              icon="i-lucide-trash-2"
              size="sm"
              variant="ghost"
              color="error"
              :aria-label="`Delete preset ${preset.name}`"
              @click="confirmDeletePreset(preset)"
            />
          </div>
        </div>
      </div>

      <p class="mt-4 text-[13px] text-gray-400">
        Embeds saved as tags are managed under
        <NuxtLink
          :to="`/dashboard/server/${guildId}/modules/tags`"
          class="text-sky-200 underline underline-offset-2 hover:text-teal-300"
        >
          Tags
        </NuxtLink>.
      </p>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="embeds" />

    <!-- ── Save dialog (preset or tag) ── -->
    <UModal
      v-model:open="saveOpen"
      :title="saveMode === 'preset' ? 'Save as preset' : 'Save as tag'"
      :description="
        saveMode === 'preset'
          ? 'Presets are private to the dashboard. Reload and tweak them later without committing to a /tag name.'
          : 'Staff post tags in Discord with /tag name.'
      "
    >
      <template #body>
        <div class="space-y-4">
          <UFormField
            :label="saveMode === 'preset' ? 'Preset name' : 'Tag name'"
            hint="Lowercase, hyphens only"
            class="w-full"
          >
            <UInput
              v-model="saveName"
              :placeholder="saveMode === 'preset' ? 'e.g. monthly-announcement' : 'e.g. welcome-rules'"
              :icon="saveMode === 'preset' ? 'i-lucide-bookmark' : 'i-lucide-tag'"
              class="w-full"
              autofocus
              @keydown.enter="saveName.trim() && confirmSave()"
            />
          </UFormField>
          <UFormField v-if="saveMode === 'preset'" label="Description" hint="Optional" class="w-full">
            <UInput
              v-model="saveDescription"
              placeholder="e.g. used for monthly product updates"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="saveOpen = false">Cancel</UButton>
          <UButton
            color="primary"
            :icon="saveMode === 'preset' ? 'i-lucide-bookmark' : 'i-lucide-tag'"
            :loading="saveBusy"
            :disabled="!saveName.trim()"
            @click="confirmSave"
          >
            {{ saveMode === "preset" ? "Save preset" : "Save tag" }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ── Delete preset confirmation ── -->
    <UModal v-model:open="deletePresetOpen">
      <template #content>
        <div class="space-y-4 p-6">
          <div class="flex items-center gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-400/10 ring-1 ring-inset ring-red-400/30"
            >
              <UIcon name="i-lucide-triangle-alert" class="h-5 w-5 text-red-300" />
            </span>
            <div>
              <h3 class="text-base font-semibold text-white">Delete preset</h3>
              <p class="text-[13px] text-gray-400">This can't be undone.</p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            Delete <strong class="font-mono text-white">{{ deletingPreset?.name }}</strong>?
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton variant="ghost" color="neutral" @click="deletePresetOpen = false">Cancel</UButton>
            <UButton
              color="error"
              icon="i-lucide-trash-2"
              :loading="deletingPresetBusy"
              @click="deletePreset"
            >
              Delete preset
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  emptyEmbedForm,
  fromEmbedData,
  hasEmbedContent,
  toEmbedPayload,
  type EmbedForm,
} from "~/utils/embed-form";

const route = useRoute();
const guildId = route.params.guild_id as string;
const { state, isModuleEnabled, loadChannels, loadRoles, channelOptions } =
  useServerSettings(guildId);
const toast = useToast();

const channels = computed(() => state.value.channels);
const channelsLoading = computed(() => state.value.channelsLoading);
const roles = computed(() => state.value.roles);

const mdContext = computed(() => ({
  channels: channels.value.map((c: any) => ({ id: c.id, name: c.name })),
  roles: roles.value.map((r: any) => ({
    id: r.id,
    name: r.name,
    color: r.color,
  })),
}));

// ── Form state ──────────────────────────────────────────────────────────
const embedForm = ref<EmbedForm>(emptyEmbedForm());
const targetChannelId = ref<string | { value: string } | "">("");
const sendingEmbed = ref(false);
const loadedFromPreset = ref<string | null>(null);
const editingPresetId = ref<string | null>(null);

const hasAnyContent = computed(() => hasEmbedContent(embedForm.value));

function resolveChannelId(): string {
  const v = targetChannelId.value;
  if (!v) return "";
  if (typeof v === "object" && v !== null && "value" in v) return v.value;
  return String(v);
}

function resetEmbedForm() {
  embedForm.value = emptyEmbedForm();
  loadedFromPreset.value = null;
  editingPresetId.value = null;
}

async function sendEmbed() {
  const channelId = resolveChannelId();
  if (!channelId) {
    toast.add({
      title: "Error",
      description: "Please select a channel.",
      color: "error",
    });
    return;
  }
  if (!hasAnyContent.value) {
    toast.add({
      title: "Error",
      description: "Embed must have at least a title, description, or fields.",
      color: "error",
    });
    return;
  }

  sendingEmbed.value = true;
  try {
    await $fetch("/api/discord/send-embed", {
      method: "POST",
      body: {
        guild_id: guildId,
        channel_id: channelId,
        embed: toEmbedPayload(embedForm.value),
      },
    });

    const channelName =
      channels.value.find((c: any) => c.id === channelId)?.name || "channel";
    toast.add({
      title: "Embed Sent!",
      description: `Successfully sent to #${channelName}.`,
      color: "success",
    });
  } catch (error: any) {
    console.error("Error sending embed:", error);
    toast.add({
      title: "Failed to Send",
      description:
        error?.data?.statusMessage || error?.message || "Unknown error.",
      color: "error",
    });
  } finally {
    sendingEmbed.value = false;
  }
}

// ── Save dialog (preset OR tag) ─────────────────────────────────────────
const saveOpen = ref(false);
const saveMode = ref<"preset" | "tag">("preset");
const saveName = ref("");
const saveDescription = ref("");
const saveBusy = ref(false);

function openSaveDialog(mode: "preset" | "tag") {
  saveMode.value = mode;
  saveName.value = "";
  saveDescription.value = "";
  saveOpen.value = true;
}

async function confirmSave() {
  saveBusy.value = true;
  try {
    const embed = toEmbedPayload(embedForm.value);
    await $fetch("/api/tags/create", {
      method: "POST",
      body: {
        guild_id: guildId,
        name: saveName.value,
        embed_data: embed,
        is_template: saveMode.value === "preset",
        description:
          saveMode.value === "preset" && saveDescription.value
            ? saveDescription.value
            : undefined,
      },
    });
    toast.add({
      title: saveMode.value === "preset" ? "Preset Saved" : "Tag Saved",
      description:
        saveMode.value === "preset"
          ? `Saved "${saveName.value}". It'll appear below under Saved Embeds.`
          : `Saved "${saveName.value}". Use /tag ${saveName.value} to post it.`,
      color: "success",
    });
    saveOpen.value = false;
    if (saveMode.value === "preset") await fetchPresets();
  } catch (error: any) {
    console.error("Error saving:", error);
    toast.add({
      title: "Error",
      description:
        error?.data?.statusMessage || error?.message || "Failed to save.",
      color: "error",
    });
  } finally {
    saveBusy.value = false;
  }
}

// ── Presets list ────────────────────────────────────────────────────────
const presets = ref<any[]>([]);
const presetsLoading = ref(true);
const savingPreset = ref(false);

async function fetchPresets() {
  presetsLoading.value = true;
  try {
    const response = await $fetch<any>("/api/tags/list", {
      params: { guild_id: guildId },
    });
    const all = response.documents || [];
    presets.value = all.filter((t: any) => t.is_template === true);
  } catch (error) {
    console.error("Error fetching presets:", error);
  } finally {
    presetsLoading.value = false;
  }
}

function presetSubtitle(preset: any): string {
  if (!preset.embed_data) return "No embed data";
  try {
    const data = JSON.parse(preset.embed_data);
    return (
      data.title ||
      (data.description ? String(data.description).slice(0, 60) : "") ||
      "Embed"
    );
  } catch {
    return "Embed";
  }
}

function presetColor(preset: any): string {
  if (!preset.embed_data) return "#5865f2";
  try {
    const data = JSON.parse(preset.embed_data);
    if (typeof data.color === "number") {
      return `#${data.color.toString(16).padStart(6, "0")}`;
    }
  } catch {}
  return "#5865f2";
}

function loadPreset(preset: any) {
  embedForm.value = fromEmbedData(preset.embed_data);
  loadedFromPreset.value = preset.name;
  editingPresetId.value = preset.$id;
  toast.add({
    title: "Preset Loaded",
    description: `"${preset.name}" is now in the editor. Edits won't be saved until you click Save Changes.`,
    color: "info",
  });
}

async function updateLoadedPreset() {
  if (!editingPresetId.value) return;
  savingPreset.value = true;
  try {
    const embed = toEmbedPayload(embedForm.value);
    await $fetch("/api/tags/update", {
      method: "PUT",
      body: {
        tag_id: editingPresetId.value,
        guild_id: guildId,
        embed_data: embed,
      },
    });
    toast.add({
      title: "Preset Updated",
      description: `Saved changes to "${loadedFromPreset.value}".`,
      color: "success",
    });
    await fetchPresets();
  } catch (error: any) {
    console.error("Error updating preset:", error);
    toast.add({
      title: "Error",
      description:
        error?.data?.statusMessage || error?.message || "Failed to update.",
      color: "error",
    });
  } finally {
    savingPreset.value = false;
  }
}

// ── Delete preset ───────────────────────────────────────────────────────
const deletePresetOpen = ref(false);
const deletingPreset = ref<any>(null);
const deletingPresetBusy = ref(false);

function confirmDeletePreset(preset: any) {
  deletingPreset.value = preset;
  deletePresetOpen.value = true;
}

async function deletePreset() {
  if (!deletingPreset.value) return;
  deletingPresetBusy.value = true;
  try {
    await $fetch("/api/tags/delete", {
      method: "POST",
      body: {
        tag_id: deletingPreset.value.$id,
        guild_id: guildId,
      },
    });
    toast.add({
      title: "Preset Deleted",
      description: `"${deletingPreset.value.name}" has been removed.`,
      color: "success",
    });
    if (editingPresetId.value === deletingPreset.value.$id) {
      loadedFromPreset.value = null;
      editingPresetId.value = null;
    }
    deletePresetOpen.value = false;
    await fetchPresets();
  } catch (error: any) {
    console.error("Error deleting preset:", error);
    toast.add({
      title: "Error",
      description:
        error?.data?.statusMessage || "Failed to delete preset.",
      color: "error",
    });
  } finally {
    deletingPresetBusy.value = false;
  }
}

onMounted(() => {
  loadChannels();
  loadRoles();
  fetchPresets();
});
</script>
