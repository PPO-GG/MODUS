<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-bar-chart-3"
      title="Polls"
      description="Native Discord polls with reusable templates and live results."
      :enabled="isModuleEnabled('polls')"
    />

    <p
      v-if="error"
      class="flex items-start gap-2 rounded-lg bg-red-400/[0.08] px-3 py-2 text-[13px] text-red-300"
      role="alert"
    >
      <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
      {{ error }}
    </p>

    <!-- ── Send a poll ── -->
    <DashboardModuleSection
      title="Send a poll"
      description="Post one of your saved templates to a channel."
    >
      <div v-if="templates.length === 0" class="space-y-3 text-center">
        <p class="text-[13px] text-gray-400">
          You don't have any templates yet. Create one to send it from here.
        </p>
        <UButton color="primary" icon="i-lucide-plus" @click="openCreate">New template</UButton>
      </div>

      <div v-else class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Template" class="w-full">
            <USelectMenu
              v-model="sendForm.template_id"
              :items="templateOptions"
              value-key="value"
              placeholder="Choose a saved template"
              searchable
              icon="i-lucide-layout-template"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Channel" class="w-full">
            <div v-if="state.channelsLoading" class="flex items-center gap-2 py-2 text-gray-400">
              <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
              <span class="text-sm">Loading channels…</span>
            </div>
            <USelectMenu
              v-else-if="channelOptions.length > 0"
              v-model="sendForm.channel_id"
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

        <DashboardPollPreview
          v-if="selectedTemplate"
          :question="selectedTemplate.question"
          :options="selectedTemplate.options"
          :duration-hours="selectedTemplate.durationHours"
          :multiselect="selectedTemplate.allowMultiselect"
        />

        <div class="flex justify-end">
          <UButton
            color="primary"
            icon="i-lucide-send"
            :loading="actionLoading"
            :disabled="!sendForm.template_id || !sendForm.channel_id"
            @click="onSendPoll"
          >
            Send poll
          </UButton>
        </div>
      </div>
    </DashboardModuleSection>

    <!-- ── Running polls ── -->
    <DashboardModuleSection
      title="Running polls"
      :description="
        loading
          ? 'Loading polls…'
          : `${runningPolls.length} poll${runningPolls.length !== 1 ? 's' : ''} running.`
      "
    >
      <template v-if="!realtimeAvailable" #actions>
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-lucide-rotate-cw"
          @click="fetchRunningPolls"
        >
          Refresh
        </UButton>
      </template>

      <p
        v-if="!realtimeAvailable"
        class="mb-4 flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
      >
        <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
        Live updates are unavailable, so this is a snapshot. Use Refresh to update it.
      </p>

      <div v-if="loading" class="space-y-2" aria-busy="true">
        <div v-for="i in 2" :key="i" class="h-24 animate-pulse rounded-lg bg-white/[0.04]" />
      </div>

      <div
        v-else-if="runningPolls.length === 0"
        class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-8 text-center"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
        >
          <UIcon name="i-lucide-bar-chart-3" class="h-5 w-5 text-sky-200" />
        </span>
        <div>
          <h4 class="text-sm font-semibold text-white">No polls running</h4>
          <p class="mt-1 text-[13px] text-gray-400">
            Send one above, or run <code class="font-mono">/poll create</code> in Discord.
          </p>
        </div>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="poll in runningPolls"
          :key="poll.id"
          class="space-y-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/10"
        >
          <div class="flex items-start gap-2">
            <p class="min-w-0 flex-1 text-sm font-medium text-white">{{ poll.question }}</p>
            <span class="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-gray-300">
              {{ poll.source === "dashboard" ? "Dashboard" : "Slash command" }}
            </span>
            <UButton
              v-if="state.isServerOwnerOrAdmin || state.accessibleModules?.includes('polls')"
              color="error"
              variant="ghost"
              size="xs"
              icon="i-lucide-circle-stop"
              @click="endTarget = poll"
            >
              End
            </UButton>
          </div>

          <div v-for="(opt, idx) in poll.options" :key="idx" class="space-y-1">
            <div class="flex justify-between gap-3 text-[13px] text-gray-300">
              <span class="min-w-0 truncate">{{ opt.text }}</span>
              <span class="shrink-0 text-gray-400">
                {{ optionPct(opt, poll.totalVotes) }}% · {{ opt.votes }}
              </span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                class="h-full rounded-full bg-gradient-to-r from-sky-300 to-teal-300 transition-all"
                :style="{ width: optionPct(opt, poll.totalVotes) + '%' }"
              />
            </div>
          </div>

          <p class="text-[13px] text-gray-400">
            {{ poll.totalVotes }} total vote{{ poll.totalVotes !== 1 ? "s" : "" }} · ends
            {{ new Date(poll.expiresAt).toLocaleString() }}
          </p>
        </div>
      </div>
    </DashboardModuleSection>

    <!-- ── Templates ── -->
    <DashboardModuleSection
      title="Templates"
      :description="`${templates.length} saved template${templates.length !== 1 ? 's' : ''}.`"
    >
      <template #actions>
        <UButton color="primary" size="sm" icon="i-lucide-plus" @click="openCreate">
          New template
        </UButton>
      </template>

      <p v-if="templates.length === 0" class="text-[13px] text-gray-400">
        Templates save a question, its answers and a duration so you can post the same poll again.
      </p>

      <ul v-else class="-mx-2 divide-y divide-white/[0.06]">
        <li v-for="template in templates" :key="template.id" class="flex items-center gap-3 px-2 py-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-white">{{ template.name }}</p>
            <p class="mt-0.5 truncate text-[13px] text-gray-400">
              {{ template.question }} · {{ template.options.length }} answers ·
              {{ template.durationHours }}h<span v-if="template.allowMultiselect"> · multiple choice</span>
            </p>
          </div>
          <UButton
            color="error"
            variant="ghost"
            size="sm"
            icon="i-lucide-trash-2"
            :aria-label="`Delete template ${template.name}`"
            @click="deleteTarget = template"
          />
        </li>
      </ul>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="polls" />

    <!-- ── New template ── -->
    <UModal
      v-model:open="showCreate"
      title="New poll template"
      description="Saved templates can be sent to any channel."
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="space-y-5">
          <UFormField label="Template name" class="w-full">
            <UInput
              v-model="newTemplate.name"
              placeholder="e.g. weekly-feedback"
              icon="i-lucide-tag"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Question" class="w-full">
            <template #hint>
              <span class="text-xs text-gray-400">{{ newTemplate.question.length }}/300</span>
            </template>
            <UTextarea
              v-model="newTemplate.question"
              placeholder="What should we build next?"
              maxlength="300"
              :rows="2"
              autoresize
              class="w-full"
            />
          </UFormField>

          <div>
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <span class="text-sm font-medium text-white">Answers</span>
              <span class="text-xs text-gray-400">{{ newTemplate.options.length }} of 10, at least 2</span>
            </div>
            <div class="space-y-2">
              <div v-for="(_, i) in newTemplate.options" :key="i" class="flex gap-2">
                <UInput
                  v-model="newTemplate.options[i]"
                  :placeholder="`Answer ${i + 1}`"
                  maxlength="55"
                  class="flex-1"
                  :aria-label="`Answer ${i + 1}`"
                />
                <UButton
                  v-if="newTemplate.options.length > 2"
                  color="error"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-x"
                  :aria-label="`Remove answer ${i + 1}`"
                  @click="newTemplate.options.splice(i, 1)"
                />
              </div>
              <UButton
                v-if="newTemplate.options.length < 10"
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-plus"
                @click="newTemplate.options.push('')"
              >
                Add answer
              </UButton>
            </div>
          </div>

          <div>
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <label class="text-sm font-medium text-white" for="poll-duration">Duration</label>
              <span class="text-xs text-gray-400">1 to 168 hours</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="p in durationPresets"
                :key="p.hours"
                type="button"
                class="rounded-full px-3 py-1.5 text-xs ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
                :class="
                  newTemplate.duration_hours === p.hours
                    ? 'bg-sky-200/[0.06] text-white ring-2 ring-teal-300/60'
                    : 'text-gray-300 ring-white/10 hover:bg-white/[0.04]'
                "
                @click="newTemplate.duration_hours = p.hours"
              >
                {{ p.label }}
              </button>
              <UInput
                id="poll-duration"
                v-model.number="newTemplate.duration_hours"
                type="number"
                :min="1"
                :max="168"
                size="sm"
                class="w-24"
                aria-label="Duration in hours"
              />
              <span class="text-xs text-gray-400">hours</span>
            </div>
          </div>

          <label
            class="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium text-white">Allow multiple choices</span>
              <span class="block text-[13px] text-gray-400">Members can vote for more than one answer.</span>
            </span>
            <USwitch v-model="newTemplate.allow_multiselect" aria-label="Allow multiple choices" />
          </label>

          <div>
            <span class="mb-2 block text-sm font-medium text-white">Preview</span>
            <DashboardPollPreview
              :question="newTemplate.question"
              :options="newTemplate.options"
              :duration-hours="newTemplate.duration_hours"
              :multiselect="newTemplate.allow_multiselect"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showCreate = false">Cancel</UButton>
          <UButton
            color="primary"
            icon="i-lucide-bookmark"
            :loading="actionLoading"
            :disabled="!canSaveTemplate"
            @click="onCreateTemplate"
          >
            Save template
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- ── End poll confirmation ── -->
    <UModal :open="!!endTarget" @update:open="(v: boolean) => !v && (endTarget = null)">
      <template #content>
        <div class="space-y-4 p-6">
          <div class="flex items-center gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-400/10 ring-1 ring-inset ring-red-400/30"
            >
              <UIcon name="i-lucide-circle-stop" class="h-5 w-5 text-red-300" />
            </span>
            <div>
              <h3 class="text-base font-semibold text-white">End poll now</h3>
              <p class="text-[13px] text-gray-400">This can't be undone.</p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            This closes voting on <strong class="text-white">"{{ endTarget?.question }}"</strong> and
            shows the final results.
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton color="neutral" variant="ghost" @click="endTarget = null">Cancel</UButton>
            <UButton color="error" icon="i-lucide-circle-stop" :loading="actionLoading" @click="confirmEnd">
              End poll
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- ── Delete template confirmation ── -->
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
              <h3 class="text-base font-semibold text-white">Delete template</h3>
              <p class="text-[13px] text-gray-400">Polls already sent aren't affected.</p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            Delete <strong class="text-white">{{ deleteTarget?.name }}</strong>?
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton color="neutral" variant="ghost" @click="deleteTarget = null">Cancel</UButton>
            <UButton color="error" icon="i-lucide-trash-2" :loading="actionLoading" @click="confirmDelete">
              Delete template
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { PollTemplate, RunningPoll } from "~/composables/usePolls";

const route = useRoute();
const guildId = route.params.guild_id as string;
const { state, isModuleEnabled, loadChannels, channelOptions } = useServerSettings(guildId);
const {
  templates,
  runningPolls,
  loading,
  actionLoading,
  error,
  realtimeAvailable,
  createTemplate,
  deleteTemplate,
  fetchRunningPolls,
  sendPoll,
  endPoll,
} = usePolls(guildId);

// ── New template ──

const showCreate = ref(false);

const durationPresets = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
];

const newTemplate = reactive({
  name: "",
  question: "",
  options: ["", ""],
  duration_hours: 24,
  allow_multiselect: false,
});

const resetNewTemplate = () => {
  newTemplate.name = "";
  newTemplate.question = "";
  newTemplate.options = ["", ""];
  newTemplate.duration_hours = 24;
  newTemplate.allow_multiselect = false;
};

const openCreate = () => {
  resetNewTemplate();
  showCreate.value = true;
};

const canSaveTemplate = computed(
  () =>
    newTemplate.name.trim() &&
    newTemplate.question.trim() &&
    newTemplate.options.filter((o) => o.trim()).length >= 2 &&
    newTemplate.duration_hours >= 1 &&
    newTemplate.duration_hours <= 168,
);

const onCreateTemplate = async () => {
  try {
    await createTemplate({
      name: newTemplate.name.trim(),
      question: newTemplate.question.trim(),
      options: newTemplate.options.map((o) => o.trim()).filter(Boolean),
      duration_hours: newTemplate.duration_hours,
      allow_multiselect: newTemplate.allow_multiselect,
    });
    showCreate.value = false;
  } catch {
    // createTemplate re-throws after populating `error`, which the banner at
    // the top of the page shows. Keep the modal open so nothing is lost.
  }
};

// ── Delete template ──

const deleteTarget = ref<PollTemplate | null>(null);

const confirmDelete = async () => {
  const target = deleteTarget.value;
  if (!target) return;
  try {
    await deleteTemplate(target.id);
    deleteTarget.value = null;
  } catch {
    // deleteTemplate re-throws after populating `error` — see onCreateTemplate.
  }
};

// ── Send ──

const templateOptions = computed(() =>
  templates.value.map((t) => ({ label: t.name, value: t.id })),
);

const selectedTemplate = computed(
  () => templates.value.find((t) => t.id === sendForm.template_id) ?? null,
);

const sendForm = reactive({ template_id: "", channel_id: "" });

const onSendPoll = async () => {
  try {
    await sendPoll({
      channel_id: sendForm.channel_id,
      template_id: sendForm.template_id,
    });
    sendForm.template_id = "";
    sendForm.channel_id = "";
  } catch {
    // sendPoll re-throws after populating `error` — see onCreateTemplate.
  }
};

// ── Running polls ──

const optionPct = (opt: { votes: number }, total: number) =>
  total > 0 ? Math.round((opt.votes / total) * 100) : 0;

const endTarget = ref<RunningPoll | null>(null);

const confirmEnd = async () => {
  const target = endTarget.value;
  if (!target) return;
  try {
    await endPoll(target.channelId, target.messageId);
    endTarget.value = null;
  } catch {
    // endPoll re-throws after populating `error` — see onCreateTemplate.
  }
};

onMounted(() => {
  loadChannels();
});
</script>
