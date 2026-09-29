<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-webhook"
      title="Webhooks"
      description="Receive events from other services and post them as embeds."
      :enabled="isModuleEnabled('triggers')"
    />

    <!-- ── Webhooks list ── -->
    <DashboardModuleSection
      title="Webhooks"
      :description="`${triggerList.length} of 25 webhooks.`"
    >
      <template #actions>
        <UButton
          color="primary"
          size="sm"
          icon="i-lucide-plus"
          :disabled="triggerList.length >= 25"
          @click="openCreate"
        >
          New webhook
        </UButton>
      </template>

      <div v-if="loading && triggerList.length === 0" class="space-y-2" aria-busy="true">
        <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-white/[0.04]" />
      </div>

      <div
        v-else-if="triggerList.length === 0"
        class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
        >
          <UIcon name="i-lucide-webhook" class="h-5 w-5 text-sky-200" />
        </span>
        <div>
          <h4 class="text-sm font-semibold text-white">No webhooks yet</h4>
          <p class="mx-auto mt-1 max-w-sm text-[13px] text-gray-400">
            Create a webhook, paste its URL into another service, and every event it sends shows up
            as an embed in your channel.
          </p>
        </div>
        <UButton color="primary" icon="i-lucide-plus" @click="openCreate">
          Create your first webhook
        </UButton>
      </div>

      <ul v-else class="-mx-2 divide-y divide-white/[0.06]">
        <li
          v-for="trigger in triggerList"
          :key="trigger.$id"
          class="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-3 transition-opacity"
          :class="trigger.enabled ? '' : 'opacity-60'"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            :class="webhookProvider(trigger.provider).tileClass"
          >
            <UIcon :name="webhookProvider(trigger.provider).icon" class="h-4 w-4" />
          </span>

          <div class="min-w-0 flex-1 basis-40">
            <button
              type="button"
              class="block max-w-full truncate text-left text-sm font-medium text-white hover:text-teal-300 focus-visible:outline-2 focus-visible:outline-teal-300"
              @click="openEdit(trigger)"
            >
              {{ trigger.name }}
            </button>
            <p class="mt-0.5 truncate text-[13px] text-gray-400">
              {{ webhookProvider(trigger.provider).label }} → {{ getChannelName(trigger.channel_id) }}
              <span v-if="trigger.created_at">
                · created {{ new Date(trigger.created_at).toLocaleDateString() }}
              </span>
            </p>
          </div>

          <div class="ml-auto flex items-center gap-1">
            <USwitch
              :model-value="trigger.enabled"
              size="sm"
              :aria-label="`${trigger.enabled ? 'Disable' : 'Enable'} ${trigger.name}`"
              @update:model-value="(val: boolean) => onToggle(trigger.$id, val)"
            />
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-copy"
              :aria-label="`Copy webhook URL for ${trigger.name}`"
              @click="copyTriggerUrl(trigger.secret)"
            />
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-pencil"
              :aria-label="`Edit ${trigger.name}`"
              @click="openEdit(trigger)"
            />
            <UButton
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-trash-2"
              :aria-label="`Delete ${trigger.name}`"
              @click="deleteTarget = trigger"
            />
          </div>
        </li>
      </ul>

      <p class="mt-4 text-[13px] text-gray-400">
        Just want new YouTube videos, RSS posts or GitHub releases?
        <NuxtLink
          :to="`/dashboard/server/${guildId}/modules/alerts`"
          class="text-sky-200 underline underline-offset-2 hover:text-teal-300"
        >
          Social Alerts
        </NuxtLink>
        needs no setup.
      </p>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="triggers" />

    <!-- ── Create webhook (two steps: details, then URL) ── -->
    <UModal
      v-model:open="showCreate"
      :title="createdUrl ? 'Webhook created' : 'New webhook'"
      :description="
        createdUrl
          ? 'Paste this URL into the other service\'s webhook settings.'
          : 'Pick what will send events and where they should be posted.'
      "
    >
      <template #body>
        <div v-if="!createdUrl" class="space-y-5">
          <UFormField label="Name" class="w-full">
            <UInput
              v-model="newTrigger.name"
              placeholder="e.g. github-prs"
              icon="i-lucide-tag"
              class="w-full"
              autofocus
              @keydown.enter="onCreate"
            />
          </UFormField>

          <div>
            <span class="mb-2 block text-sm font-medium text-white">Provider</span>
            <div class="grid grid-cols-1 gap-3" role="radiogroup" aria-label="Provider">
              <label v-for="p in webhookProviders" :key="p.value" class="block cursor-pointer">
                <input
                  v-model="newTrigger.provider"
                  type="radio"
                  name="webhook-provider"
                  :value="p.value"
                  class="peer sr-only"
                />
                <div
                  class="flex items-start gap-3 rounded-xl p-3.5 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-checked:bg-sky-200/[0.06] peer-checked:ring-2 peer-checked:ring-teal-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
                >
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    :class="p.tileClass"
                  >
                    <UIcon :name="p.icon" class="h-4 w-4" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-semibold text-white">{{ p.label }}</span>
                    <span class="block text-[13px] leading-relaxed text-gray-400">
                      {{ p.description }}
                    </span>
                  </span>
                  <UIcon
                    v-if="newTrigger.provider === p.value"
                    name="i-lucide-circle-check"
                    class="h-5 w-5 shrink-0 text-teal-300"
                  />
                </div>
              </label>
            </div>
          </div>

          <UFormField label="Post in channel" class="w-full">
            <USelectMenu
              v-if="channelOptions.length > 0"
              v-model="newTrigger.channel_id"
              :items="channelOptions"
              value-key="value"
              placeholder="Select a channel"
              searchable
              icon="i-lucide-hash"
              class="w-full"
            />
            <p v-else class="py-2 text-sm italic text-gray-500">No channels available.</p>
          </UFormField>
        </div>

        <div v-else class="space-y-4">
          <div
            class="select-all break-all rounded-lg bg-black/30 p-3 font-mono text-xs text-teal-300 ring-1 ring-inset ring-white/10"
          >
            {{ createdUrl }}
          </div>
          <p
            class="flex items-start gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
          >
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
            <span>Keep this secret. Anyone with the URL can post messages to your channel.</span>
          </p>
        </div>
      </template>

      <template #footer>
        <div v-if="!createdUrl" class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showCreate = false">Cancel</UButton>
          <UButton
            color="primary"
            icon="i-lucide-plus"
            :loading="actionLoading"
            :disabled="!newTrigger.name.trim() || !newTrigger.channel_id"
            @click="onCreate"
          >
            Create webhook
          </UButton>
        </div>
        <div v-else class="flex w-full flex-wrap justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showCreate = false">Done</UButton>
          <UButton color="neutral" variant="soft" icon="i-lucide-copy" @click="copyUrl">
            Copy URL
          </UButton>
          <UButton color="primary" icon="i-lucide-pencil" @click="customizeCreated">
            Customize embed
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
              <h3 class="text-base font-semibold text-white">Delete webhook</h3>
              <p class="text-[13px] text-gray-400">This can't be undone.</p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            Delete <strong class="text-white">{{ deleteTarget?.name }}</strong>? Its URL stops
            working right away.
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton color="neutral" variant="ghost" @click="deleteTarget = null">Cancel</UButton>
            <UButton
              color="error"
              icon="i-lucide-trash-2"
              :loading="actionLoading"
              @click="confirmDelete"
            >
              Delete webhook
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <TriggerBuilderModal
      v-model:open="isBuilderOpen"
      :trigger="activeTriggerForBuild"
      :channel-options="channelOptions"
      @save="onSaveBuilder"
    />
  </div>
</template>

<script setup lang="ts">
import TriggerBuilderModal from "~/components/dashboard/TriggerBuilderModal.vue";
import type { TriggerDocument } from "~/composables/useTriggers";
import { webhookProviders, webhookProvider } from "~/utils/webhook-providers";

const route = useRoute();
const guildId = route.params.guild_id as string;
const { state, isModuleEnabled, loadChannels, channelOptions } = useServerSettings(guildId);
const toast = useToast();

// ── Channels ──
const getChannelName = (id: string) => {
  const ch = state.value.channels.find((c: any) => c.id === id);
  return ch ? `#${ch.name}` : `#${id}`;
};

// ── Triggers CRUD ──
const {
  triggers: triggerList,
  loading,
  actionLoading,
  createTrigger,
  deleteTrigger,
  toggleTrigger,
  updateTrigger,
  getWebhookUrl,
} = useTriggers(guildId);

// ── Create ──
const showCreate = ref(false);
const createdUrl = ref("");
const createdSecret = ref("");

const newTrigger = reactive({
  name: "",
  provider: "webhook" as "webhook" | "github" | "twitch",
  channel_id: "",
});

const openCreate = () => {
  createdUrl.value = "";
  createdSecret.value = "";
  newTrigger.name = "";
  newTrigger.provider = "webhook";
  newTrigger.channel_id = "";
  showCreate.value = true;
};

const onCreate = async () => {
  if (!newTrigger.name.trim() || !newTrigger.channel_id) return;
  try {
    const secret = await createTrigger({
      name: newTrigger.name.trim(),
      provider: newTrigger.provider,
      channel_id: newTrigger.channel_id,
    });
    createdSecret.value = secret!;
    createdUrl.value = getWebhookUrl(secret!);
  } catch {
    toast.add({ title: "Failed to create webhook", color: "error" });
  }
};

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(createdUrl.value);
    toast.add({ title: "Copied to clipboard", color: "success" });
  } catch {
    toast.add({ title: "Failed to copy", color: "error" });
  }
};

const copyTriggerUrl = async (secret: string) => {
  try {
    await navigator.clipboard.writeText(getWebhookUrl(secret));
    toast.add({ title: "URL copied", color: "success" });
  } catch {
    toast.add({ title: "Failed to copy", color: "error" });
  }
};

// ── Toggle / delete ──
const onToggle = async (id: string, enabled: boolean) => {
  try {
    await toggleTrigger(id, enabled);
  } catch {
    toast.add({ title: "Failed to update webhook", color: "error" });
  }
};

const deleteTarget = ref<TriggerDocument | null>(null);

const confirmDelete = async () => {
  const target = deleteTarget.value;
  if (!target) return;
  try {
    await deleteTrigger(target.$id);
    toast.add({ title: "Webhook deleted", color: "success" });
    deleteTarget.value = null;
  } catch {
    toast.add({ title: "Failed to delete webhook", color: "error" });
  }
};

// ── Editor ──
const isBuilderOpen = ref(false);
const activeTriggerForBuild = ref<TriggerDocument | null>(null);

const openEdit = (trigger: TriggerDocument) => {
  activeTriggerForBuild.value = trigger;
  isBuilderOpen.value = true;
};

// After creating, jump straight into the embed editor for the new webhook.
const customizeCreated = () => {
  const created = triggerList.value.find((t) => t.secret === createdSecret.value);
  showCreate.value = false;
  if (created) openEdit(created);
};

const onSaveBuilder = async (data: Record<string, any>) => {
  if (!activeTriggerForBuild.value) return;
  try {
    await updateTrigger(activeTriggerForBuild.value.$id, data);
    toast.add({ title: "Webhook saved", color: "success" });
  } catch {
    toast.add({ title: "Failed to save webhook", color: "error" });
  }
};

onMounted(() => {
  loadChannels();
});
</script>
