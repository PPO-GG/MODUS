<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-tag"
      title="Tags & Snippets"
      description="Reusable text or embed messages that staff post with /tag."
      :enabled="isModuleEnabled('tags')"
    />

    <!-- ── Tags list ── -->
    <DashboardModuleSection
      title="Tags"
      :description="
        loading ? 'Loading tags…' : `${tags.length} tag${tags.length !== 1 ? 's' : ''}.`
      "
    >
      <template #actions>
        <UButton color="primary" size="sm" icon="i-lucide-plus" @click="openEditor(null)">
          New tag
        </UButton>
      </template>

      <div v-if="loading" class="space-y-2" aria-busy="true">
        <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-white/[0.04]" />
      </div>

      <div
        v-else-if="tags.length === 0"
        class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
        >
          <UIcon name="i-lucide-tag" class="h-5 w-5 text-sky-200" />
        </span>
        <div>
          <h4 class="text-sm font-semibold text-white">No tags yet</h4>
          <p class="mx-auto mt-1 max-w-sm text-[13px] text-gray-400">
            Create a tag to give staff quick access to a pre-written message or embed.
          </p>
        </div>
        <UButton color="primary" icon="i-lucide-plus" @click="openEditor(null)">
          Create your first tag
        </UButton>
      </div>

      <ul v-else class="-mx-2 divide-y divide-white/[0.06]">
        <li
          v-for="tag in tags"
          :key="tag.$id"
          class="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-3"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-200/10 text-sky-200"
          >
            <UIcon :name="tag.embed_data ? 'i-lucide-layout-template' : 'i-lucide-file-text'" class="h-4 w-4" />
          </span>

          <div class="min-w-0 flex-1 basis-48">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <button
                type="button"
                class="rounded bg-white/[0.06] px-2 py-0.5 font-mono text-sm font-medium text-white hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300"
                @click="openEditor(tag)"
              >
                {{ tag.name }}
              </button>
              <span class="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-gray-300">
                {{ tag.embed_data ? (tag.content ? "Text + embed" : "Embed") : "Text" }}
              </span>
              <span
                v-if="getTagRoles(tag).length > 0"
                class="inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-300"
              >
                <UIcon name="i-lucide-lock" class="h-3 w-3" />
                {{ getTagRoles(tag).length }} role{{ getTagRoles(tag).length !== 1 ? "s" : "" }}
              </span>
            </div>
            <p class="mt-1 truncate text-[13px] text-gray-400">{{ getTagPreview(tag) }}</p>
          </div>

          <div class="ml-auto flex items-center gap-1">
            <UButton
              icon="i-lucide-eye"
              size="sm"
              variant="ghost"
              color="neutral"
              :aria-label="`Preview ${tag.name}`"
              @click="previewTag(tag)"
            />
            <UButton
              icon="i-lucide-send"
              size="sm"
              variant="ghost"
              color="neutral"
              :aria-label="`Send ${tag.name} to a channel`"
              @click="openSendDialog(tag)"
            />
            <UButton
              icon="i-lucide-pencil"
              size="sm"
              variant="ghost"
              color="neutral"
              :aria-label="`Edit ${tag.name}`"
              @click="openEditor(tag)"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="sm"
              variant="ghost"
              color="error"
              :aria-label="`Delete ${tag.name}`"
              @click="confirmDelete(tag)"
            />
          </div>
        </li>
      </ul>

      <p class="mt-4 text-[13px] text-gray-400">
        Presets saved from the
        <NuxtLink
          :to="`/dashboard/server/${guildId}/modules/embeds`"
          class="text-sky-200 underline underline-offset-2 hover:text-teal-300"
        >
          Embed Builder
        </NuxtLink>
        are kept separately and aren't listed here.
      </p>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="tags" />

    <!-- ── Tag editor slide-over ── -->
    <USlideover
      v-model:open="editorOpen"
      :title="editingTag ? 'Edit tag' : 'New tag'"
      :description="editingTag ? editingTag.name : 'Staff post it with /tag name.'"
      :ui="{ content: 'sm:max-w-5xl' }"
    >
      <template #body>
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <div class="min-w-0 space-y-6">
            <DashboardModuleSection title="Basics">
              <div class="space-y-5">
                <UFormField
                  label="Tag name"
                  :hint="editingTag ? 'Can\'t be changed' : undefined"
                  class="w-full"
                >
                  <UInput
                    v-model="form.name"
                    placeholder="e.g. shipping-policy"
                    icon="i-lucide-tag"
                    class="w-full"
                    :disabled="!!editingTag"
                  />
                </UFormField>
                <p class="-mt-3 text-[13px] text-gray-400">
                  Lowercase with hyphens. Used as
                  <code class="font-mono text-sky-200">/tag {{ form.name || "name" }}</code>.
                </p>

                <div>
                  <span class="mb-2 block text-sm font-medium text-white">Type</span>
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Tag type">
                    <label v-for="t in tagTypes" :key="t.value" class="block cursor-pointer">
                      <input
                        v-model="form.type"
                        type="radio"
                        name="tag-type"
                        :value="t.value"
                        class="peer sr-only"
                      />
                      <span
                        class="flex h-full flex-col gap-1 rounded-xl p-3 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-checked:bg-sky-200/[0.06] peer-checked:ring-2 peer-checked:ring-teal-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
                      >
                        <span class="flex items-center gap-2 text-sm font-semibold text-white">
                          <UIcon :name="t.icon" class="h-4 w-4 text-sky-200" />
                          {{ t.label }}
                        </span>
                        <span class="text-[13px] text-gray-400">{{ t.description }}</span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </DashboardModuleSection>

            <DashboardModuleSection title="Message">
              <div class="space-y-5">
                <UFormField
                  v-if="form.type === 'text' || form.type === 'both'"
                  label="Text"
                  class="w-full"
                >
                  <template #hint>
                    <span class="text-xs text-gray-400">{{ form.content.length }}/4096</span>
                  </template>
                  <UTextarea
                    v-model="form.content"
                    placeholder="Type your message here…"
                    :rows="4"
                    :maxlength="4096"
                    autoresize
                    class="w-full"
                  />
                </UFormField>

                <EmbedEditor
                  v-if="form.type === 'embed' || form.type === 'both'"
                  v-model="form.embed"
                />
              </div>
            </DashboardModuleSection>

            <DashboardModuleSection
              title="Permissions"
              description="Limit who can post this tag. Leave empty to allow everyone."
            >
              <USelectMenu
                v-model="form.allowedRoles"
                :items="roleOptions"
                value-key="value"
                multiple
                placeholder="All roles can use this tag"
                icon="i-lucide-shield-check"
                class="w-full"
              />
            </DashboardModuleSection>
          </div>

          <div class="min-w-0 lg:sticky lg:top-0 lg:self-start">
            <span class="mb-2 block text-sm font-medium text-white">Preview</span>
            <EmbedPreview
              :form="form.type === 'text' ? blankEmbedForm : form.embed"
              :content="form.type === 'text' || form.type === 'both' ? form.content : undefined"
              :context="mdContext"
            />
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="editorOpen = false">Cancel</UButton>
          <UButton
            color="primary"
            icon="i-lucide-check"
            :loading="saving"
            :disabled="!isFormValid"
            @click="saveTag"
          >
            {{ editingTag ? "Save changes" : "Create tag" }}
          </UButton>
        </div>
      </template>
    </USlideover>

    <!-- ── Preview modal ── -->
    <UModal
      v-model:open="previewOpen"
      :title="`Preview: ${previewingTag?.name ?? ''}`"
      description="How the tag looks when posted."
    >
      <template #body>
        <EmbedPreview
          v-if="previewingTag"
          :form="previewForm"
          :content="previewingTag.content || undefined"
          :context="mdContext"
        />
      </template>
    </UModal>

    <!-- ── Send to channel modal ── -->
    <UModal
      v-model:open="sendOpen"
      :title="`Send: ${sendingTag?.name ?? ''}`"
      description="Post this tag to a channel now."
    >
      <template #body>
        <UFormField label="Channel" class="w-full">
          <div v-if="channelsLoading" class="flex items-center gap-2 py-2 text-gray-400">
            <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
            <span class="text-sm">Loading channels…</span>
          </div>
          <USelectMenu
            v-else
            v-model="sendChannelId"
            :items="channelOptions"
            value-key="value"
            placeholder="Select a channel"
            searchable
            icon="i-lucide-hash"
            class="w-full"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="sendOpen = false">Cancel</UButton>
          <UButton
            color="primary"
            icon="i-lucide-send"
            :loading="sendingMessage"
            :disabled="!sendChannelId"
            @click="sendTagToChannel"
          >
            Send
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ── Delete confirmation ── -->
    <UModal v-model:open="deleteOpen">
      <template #content>
        <div class="space-y-4 p-6">
          <div class="flex items-center gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-400/10 ring-1 ring-inset ring-red-400/30"
            >
              <UIcon name="i-lucide-triangle-alert" class="h-5 w-5 text-red-300" />
            </span>
            <div>
              <h3 class="text-base font-semibold text-white">Delete tag</h3>
              <p class="text-[13px] text-gray-400">This can't be undone.</p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            Delete <strong class="font-mono text-white">{{ deletingTag?.name }}</strong>? Staff
            will no longer be able to post it.
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton color="neutral" variant="ghost" @click="deleteOpen = false">Cancel</UButton>
            <UButton color="error" icon="i-lucide-trash-2" :loading="deleting" @click="deleteTag">
              Delete tag
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
  toEmbedPayload,
  hasEmbedContent,
  type EmbedForm,
} from "~/utils/embed-form";

const route = useRoute();
const guildId = route.params.guild_id as string;
const { state, isModuleEnabled, loadChannels, loadRoles, channelOptions, roleOptions } =
  useServerSettings(guildId);
const toast = useToast();

const channels = computed(() => state.value.channels);
const channelsLoading = computed(() => state.value.channelsLoading);
const rolesList = computed(() => state.value.roles);

const mdContext = computed(() => ({
  channels: channels.value.map((c: any) => ({ id: c.id, name: c.name })),
  roles: rolesList.value.map((r: any) => ({
    id: r.id,
    name: r.name,
    color: r.color,
  })),
}));

const tagTypes = [
  { value: "text", label: "Plain text", icon: "i-lucide-file-text", description: "A regular message." },
  { value: "embed", label: "Embed", icon: "i-lucide-layout-template", description: "A rich card." },
  { value: "both", label: "Both", icon: "i-lucide-layers", description: "Text above an embed." },
] as const;

// ── Data ──
// Tags list — excludes presets (is_template=true) so the /tag-invocable set
// stays clean. Presets live on the embeds page.
const tags = ref<any[]>([]);
const loading = ref(true);

interface TagFormState {
  name: string;
  type: "text" | "embed" | "both";
  content: string;
  embed: EmbedForm;
  allowedRoles: string[];
}

function newTagForm(): TagFormState {
  return {
    name: "",
    type: "text",
    content: "",
    embed: emptyEmbedForm(),
    allowedRoles: [],
  };
}

// A stable empty-form reference the preview can fall back to for text-only
// tags — prevents unnecessary re-renders.
const blankEmbedForm = emptyEmbedForm();

// ── Editor State ──
const editorOpen = ref(false);
const editingTag = ref<any>(null);
const saving = ref(false);
const form = ref<TagFormState>(newTagForm());

const isFormValid = computed(() => {
  if (!form.value.name.trim()) return false;

  const hasText = form.value.content.trim().length > 0;
  const hasEmbed = hasEmbedContent(form.value.embed);

  if (form.value.type === "text") return hasText;
  if (form.value.type === "embed") return hasEmbed;
  return hasText || hasEmbed;
});

// ── Preview State ──
const previewOpen = ref(false);
const previewingTag = ref<any>(null);

const previewForm = computed<EmbedForm>(() => {
  if (!previewingTag.value?.embed_data) return blankEmbedForm;
  return fromEmbedData(previewingTag.value.embed_data);
});

// ── Send State ──
const sendOpen = ref(false);
const sendingTag = ref<any>(null);
const sendChannelId = ref<string | { value: string } | "">("");
const sendingMessage = ref(false);

// ── Delete State ──
const deleteOpen = ref(false);
const deletingTag = ref<any>(null);
const deleting = ref(false);

// ── Helpers ──
function getTagPreview(tag: any): string {
  if (tag.content) return tag.content.slice(0, 100);
  if (tag.embed_data) {
    try {
      const data = JSON.parse(tag.embed_data);
      return data.title || data.description?.slice(0, 100) || "Embed";
    } catch {
      return "Embed";
    }
  }
  return "No content";
}

function getTagRoles(tag: any): string[] {
  if (!tag.allowed_roles) return [];
  try {
    const parsed = JSON.parse(tag.allowed_roles);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resolveChannelId(): string {
  const v = sendChannelId.value;
  if (!v) return "";
  if (typeof v === "object" && v !== null && "value" in v) return v.value;
  return String(v);
}

// ── Actions ──
async function fetchTags() {
  loading.value = true;
  try {
    const response = await $fetch<any>("/api/tags/list", {
      params: { guild_id: guildId },
    });
    const all = response.documents || [];
    // Exclude presets — they're managed on the embeds page.
    tags.value = all.filter((t: any) => t.is_template !== true);
  } catch (error) {
    console.error("Error fetching tags:", error);
    toast.add({
      title: "Error",
      description: "Failed to load tags.",
      color: "error",
    });
  } finally {
    loading.value = false;
  }
}

function openEditor(tag: any | null) {
  editingTag.value = tag;
  if (tag) {
    const hasEmbed = !!tag.embed_data;
    const hasContent = !!tag.content;
    form.value = {
      name: tag.name,
      type: hasEmbed && hasContent ? "both" : hasEmbed ? "embed" : "text",
      content: tag.content || "",
      embed: fromEmbedData(tag.embed_data),
      allowedRoles: getTagRoles(tag),
    };
  } else {
    form.value = newTagForm();
  }
  editorOpen.value = true;
}

async function saveTag() {
  saving.value = true;
  try {
    const includeEmbed =
      form.value.type === "embed" || form.value.type === "both";
    const includeText =
      form.value.type === "text" || form.value.type === "both";

    const embedData = includeEmbed
      ? JSON.stringify(toEmbedPayload(form.value.embed))
      : undefined;

    const content = includeText ? form.value.content : undefined;

    if (editingTag.value) {
      await $fetch("/api/tags/update", {
        method: "PUT",
        body: {
          tag_id: editingTag.value.$id,
          guild_id: guildId,
          content: content || "",
          embed_data: embedData || "",
          allowed_roles: form.value.allowedRoles,
        },
      });
      toast.add({
        title: "Tag Updated",
        description: `Tag "${form.value.name}" has been updated.`,
        color: "success",
      });
    } else {
      await $fetch("/api/tags/create", {
        method: "POST",
        body: {
          guild_id: guildId,
          name: form.value.name,
          content,
          embed_data: embedData,
          allowed_roles: form.value.allowedRoles,
        },
      });
      toast.add({
        title: "Tag Created",
        description: `Tag "${form.value.name}" has been created.`,
        color: "success",
      });
    }

    editorOpen.value = false;
    await fetchTags();
  } catch (error: any) {
    console.error("Error saving tag:", error);
    toast.add({
      title: "Error",
      description:
        error?.data?.statusMessage || error?.message || "Failed to save tag.",
      color: "error",
    });
  } finally {
    saving.value = false;
  }
}

function previewTag(tag: any) {
  previewingTag.value = tag;
  previewOpen.value = true;
}

function openSendDialog(tag: any) {
  sendingTag.value = tag;
  sendChannelId.value = "";
  sendOpen.value = true;
  loadChannels();
}

async function sendTagToChannel() {
  if (!sendingTag.value) return;
  const channelId = resolveChannelId();
  if (!channelId) return;

  sendingMessage.value = true;
  try {
    const tag = sendingTag.value;
    let embed: Record<string, any> | undefined;

    if (tag.embed_data) {
      try {
        embed = JSON.parse(tag.embed_data);
      } catch {}
    }

    if (embed) {
      await $fetch("/api/discord/send-embed", {
        method: "POST",
        body: {
          guild_id: guildId,
          channel_id: channelId,
          embed,
          content: tag.content || undefined,
        },
      });
    } else {
      // Text-only: wrap in a minimal embed (until we add a plain-message endpoint).
      await $fetch("/api/discord/send-embed", {
        method: "POST",
        body: {
          guild_id: guildId,
          channel_id: channelId,
          embed: {
            description: tag.content,
            color: 0x5865f2,
          },
        },
      });
    }

    const channelName =
      channels.value.find((c: any) => c.id === channelId)?.name || "channel";
    toast.add({
      title: "Tag Sent!",
      description: `Successfully sent "${tag.name}" to #${channelName}.`,
      color: "success",
    });

    sendOpen.value = false;
  } catch (error: any) {
    console.error("Error sending tag:", error);
    toast.add({
      title: "Failed to Send",
      description:
        error?.data?.statusMessage || error?.message || "Unknown error.",
      color: "error",
    });
  } finally {
    sendingMessage.value = false;
  }
}

function confirmDelete(tag: any) {
  deletingTag.value = tag;
  deleteOpen.value = true;
}

async function deleteTag() {
  if (!deletingTag.value) return;
  deleting.value = true;
  try {
    await $fetch("/api/tags/delete", {
      method: "POST",
      body: {
        tag_id: deletingTag.value.$id,
        guild_id: guildId,
      },
    });
    toast.add({
      title: "Tag Deleted",
      description: `Tag "${deletingTag.value.name}" has been deleted.`,
      color: "success",
    });
    deleteOpen.value = false;
    await fetchTags();
  } catch (error: any) {
    console.error("Error deleting tag:", error);
    toast.add({
      title: "Error",
      description: error?.data?.statusMessage || "Failed to delete tag.",
      color: "error",
    });
  } finally {
    deleting.value = false;
  }
}

// ── Init ──
onMounted(async () => {
  await Promise.all([fetchTags(), loadRoles()]);
});
</script>
