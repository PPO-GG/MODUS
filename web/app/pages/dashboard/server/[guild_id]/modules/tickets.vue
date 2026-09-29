<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-ticket"
      title="Ticket System"
      description="Private, thread-based support tickets."
      :enabled="isModuleEnabled('tickets')"
    />

    <!-- ── Open tickets (same live list as the Overview page) ── -->
    <div class="[&_ul]:max-h-72 [&_ul]:overflow-y-auto">
      <OverviewOpenTickets :guild-id="guildId" />
    </div>

    <!-- ── Panel ── -->
    <DashboardModuleSection
      title="Panel"
      description="The message members use to open a ticket."
    >
      <div class="space-y-5">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField
            label="Panel channel"
            description="Where the panel is posted."
            class="w-full"
          >
            <div v-if="state.channelsLoading" class="flex items-center gap-2 py-2 text-gray-400">
              <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
              <span class="text-sm">Loading channels…</span>
            </div>
            <USelectMenu
              v-else
              v-model="settings.panelChannelId"
              :items="channelOptions"
              value-key="value"
              placeholder="Channel for the panel…"
              searchable
              icon="i-lucide-hash"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Default thread channel"
            description="Private threads are created here. Defaults to the panel channel."
            class="w-full"
          >
            <USelectMenu
              v-if="!state.channelsLoading"
              v-model="settings.defaultParentChannelId"
              :items="channelOptions"
              value-key="value"
              placeholder="Channel that hosts ticket threads…"
              searchable
              icon="i-lucide-message-square"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_14rem]">
          <UFormField label="Embed title" class="w-full">
            <UInput
              v-model="settings.panelEmbed.title"
              placeholder="Support tickets"
              icon="i-lucide-ticket"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Accent color" class="w-full">
            <div class="flex items-center gap-2">
              <input
                v-model="settings.panelEmbed.color"
                type="color"
                aria-label="Pick accent color"
                class="h-8 w-11 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
              />
              <UInput
                v-model="settings.panelEmbed.color"
                placeholder="#5865F2"
                icon="i-lucide-palette"
                class="w-full"
              />
            </div>
          </UFormField>
        </div>

        <UFormField label="Embed description" class="w-full">
          <UTextarea
            v-model="settings.panelEmbed.description"
            placeholder="Need help? Click a button below to open a private support ticket with our staff."
            :rows="2"
            autoresize
            class="w-full"
          />
        </UFormField>

        <div>
          <span class="mb-2 block text-sm font-medium text-white">Preview</span>
          <div class="rounded-xl bg-[#313338] p-4">
            <div
              v-if="hasPanelEmbed"
              class="max-w-md rounded border-l-4 bg-[#2b2d31] p-3"
              :style="{ borderLeftColor: settings.panelEmbed.color || '#5865F2' }"
            >
              <p v-if="settings.panelEmbed.title" class="text-base font-semibold text-white">
                {{ settings.panelEmbed.title }}
              </p>
              <p
                v-if="settings.panelEmbed.description"
                class="mt-1 whitespace-pre-line text-sm text-[#dbdee1]"
              >
                {{ settings.panelEmbed.description }}
              </p>
            </div>

            <!-- Single generic button, up to 5 type buttons, or a dropdown for 6+ -->
            <div
              v-if="namedTypes.length <= 5"
              class="flex flex-wrap gap-2"
              :class="hasPanelEmbed ? 'mt-2' : ''"
            >
              <template v-if="namedTypes.length === 0">
                <span
                  class="inline-flex select-none items-center gap-1.5 rounded bg-[#5865F2] px-4 py-1.5 text-sm font-medium text-white"
                >
                  Open Ticket
                </span>
              </template>
              <template v-else>
                <span
                  v-for="t in namedTypes"
                  :key="t.id"
                  class="inline-flex select-none items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium text-white"
                  :style="{ backgroundColor: styleHex(t.buttonStyle) }"
                >
                  <span v-if="t.emoji">{{ t.emoji }}</span>
                  {{ t.name }}
                </span>
              </template>
            </div>
            <div
              v-else
              class="max-w-sm overflow-hidden rounded bg-[#1e1f22] ring-1 ring-black/40"
              :class="hasPanelEmbed ? 'mt-2' : ''"
            >
              <p class="px-3 pt-2 text-[11px] uppercase tracking-wide text-[#949ba4]">
                Ticket types (dropdown)
              </p>
              <div
                v-for="t in namedTypes"
                :key="t.id"
                class="flex items-center gap-2 px-3 py-2 text-sm text-[#dbdee1]"
              >
                <span v-if="t.emoji">{{ t.emoji }}</span>
                {{ t.name }}
              </div>
            </div>
          </div>

          <p
            v-if="dirty"
            class="mt-3 flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
          >
            <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
            You have unsaved changes. Save before posting or updating the panel.
          </p>
          <p
            v-else-if="deployedMessageId"
            class="mt-3 flex items-center gap-2 rounded-lg bg-emerald-400/[0.08] px-3 py-2 text-[13px] text-emerald-300"
          >
            <UIcon name="i-lucide-circle-check" class="h-4 w-4 shrink-0" />
            <span>
              Deployed. Run <code class="font-mono">/tickets config</code> again to update the
              panel in place.
            </span>
          </p>
          <p v-else class="mt-3 text-[13px] text-gray-400">
            Not deployed yet. Run <code class="font-mono">/tickets config</code> in Discord to post
            the panel.
          </p>
        </div>
      </div>
    </DashboardModuleSection>

    <!-- ── Ticket types ── -->
    <DashboardModuleSection
      title="Ticket types"
      description="Up to 5 types show as buttons; 6 to 25 use a dropdown. With none, members get a single Open Ticket button."
    >
      <template #actions>
        <UButton
          size="sm"
          color="primary"
          variant="soft"
          icon="i-lucide-plus"
          :disabled="settings.types.length >= 25"
          @click="addType"
        >
          Add type
        </UButton>
      </template>

      <p v-if="settings.types.length === 0" class="text-[13px] text-gray-400">
        No types yet. A single "Open Ticket" button is shown.
      </p>

      <div v-else class="space-y-3">
        <div
          v-for="(type, i) in settings.types"
          :key="type.id"
          class="space-y-4 rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/10"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-white">Type {{ i + 1 }}</span>
            <UButton
              size="sm"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              :aria-label="`Remove type ${i + 1}`"
              @click="removeType(i)"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
            <UFormField label="Name" class="w-full">
              <UInput
                v-model="type.name"
                placeholder="e.g. General support"
                icon="i-lucide-tag"
                :maxlength="80"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Emoji" hint="Optional" class="w-full">
              <UInput v-model="type.emoji" placeholder="🎫" icon="i-lucide-smile" class="w-full" />
            </UFormField>
          </div>
          <p
            v-if="!type.name.trim()"
            class="-mt-2 flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
          >
            <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
            Give this type a name. Types without one aren't saved.
          </p>

          <div>
            <span class="mb-2 block text-sm font-medium text-white">Button color</span>
            <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Button color">
              <label v-for="opt in buttonStyleOptions" :key="opt.value" class="cursor-pointer">
                <input
                  v-model="type.buttonStyle"
                  type="radio"
                  :name="`type-style-${type.id}`"
                  :value="opt.value"
                  class="peer sr-only"
                />
                <span
                  class="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-checked:bg-sky-200/[0.06] peer-checked:text-white peer-checked:ring-2 peer-checked:ring-teal-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
                >
                  <span class="h-3 w-3 rounded-full" :style="{ backgroundColor: opt.hex }" aria-hidden="true" />
                  {{ opt.label }}
                </span>
              </label>
            </div>
          </div>

          <UFormField
            label="Dropdown description"
            description="Shown under the name when there are 6 or more types."
            class="w-full"
          >
            <template #hint>
              <span class="text-xs text-gray-400">{{ type.description.length }}/100</span>
            </template>
            <UInput
              v-model="type.description"
              placeholder="Open a general support ticket"
              :maxlength="100"
              class="w-full"
            />
          </UFormField>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField
              label="Thread channel"
              description="Overrides the default thread channel."
              class="w-full"
            >
              <USelectMenu
                v-if="!state.channelsLoading"
                v-model="type.parentChannelId"
                :items="[{ label: 'Use default', value: '' }, ...channelOptions]"
                value-key="value"
                placeholder="Use default"
                searchable
                icon="i-lucide-message-square"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Staff roles"
              description="Overrides the global staff roles for this type."
              class="w-full"
            >
              <USelectMenu
                v-if="!state.rolesLoading"
                v-model="type.staffRoleIds"
                :items="roleOptions"
                value-key="value"
                multiple
                placeholder="Use global staff roles"
                searchable
                icon="i-lucide-users"
                class="w-full"
              />
            </UFormField>
          </div>

          <details class="group rounded-lg ring-1 ring-inset ring-white/10">
            <summary
              class="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm text-white select-none"
            >
              <span class="flex items-center gap-2">
                <UIcon name="i-lucide-message-circle-question" class="h-4 w-4 text-sky-200" />
                Questions for this type
                <span class="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-gray-300">
                  {{ type.questions.length }}
                </span>
              </span>
              <UIcon
                name="i-lucide-chevron-down"
                class="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180"
              />
            </summary>
            <div class="space-y-3 border-t border-white/[0.06] p-3">
              <p class="text-[13px] text-gray-400">
                Asked in a form before this type opens. If empty, the global questions are used.
              </p>
              <DashboardTicketQuestionsEditor
                v-model="type.questions"
                empty-text="No questions for this type."
              />
            </div>
          </details>
        </div>
      </div>
    </DashboardModuleSection>

    <!-- ── Pre-open questions ── -->
    <DashboardModuleSection
      title="Pre-open questions"
      description="Members answer these in a form before a ticket opens. Types with their own questions use those instead."
    >
      <DashboardTicketQuestionsEditor
        v-model="settings.questions"
        empty-text="No questions. Tickets open straight away."
      />
    </DashboardModuleSection>

    <!-- ── Behaviour ── -->
    <DashboardModuleSection title="Behaviour" description="Limits and naming for new tickets.">
      <div class="space-y-5">
        <div>
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <label class="text-sm font-medium text-white" for="ticket-max">Open tickets per member</label>
            <span class="text-sm text-sky-200">
              {{ settings.maxTicketsPerUser === 0 ? "Unlimited" : `${settings.maxTicketsPerUser} at a time` }}
            </span>
          </div>
          <UInput
            id="ticket-max"
            v-model.number="settings.maxTicketsPerUser"
            type="number"
            :min="0"
            :max="10"
            icon="i-lucide-users"
            class="w-full sm:w-48"
          />
          <p class="mt-2 text-[13px] text-gray-400">0 means unlimited.</p>
        </div>

        <div class="border-t border-white/[0.06] pt-5">
          <UFormField label="Thread naming template" class="w-full">
            <UInput
              v-model="settings.namingTemplate"
              placeholder="ticket-{count}-{username}"
              icon="i-lucide-pencil"
              class="w-full"
            />
          </UFormField>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <span class="text-[13px] text-gray-400">Insert:</span>
            <button
              v-for="token in namingTokens"
              :key="token"
              type="button"
              class="rounded-md bg-white/5 px-2 py-0.5 font-mono text-[12px] text-sky-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-sky-200/10 hover:ring-sky-200/30 focus-visible:outline-2 focus-visible:outline-teal-300"
              @click="insertToken(token)"
            >
              {{ token }}
            </button>
          </div>
          <p class="mt-3 flex items-center gap-2 rounded-lg bg-sky-200/[0.06] px-3 py-2 text-[13px] text-sky-200">
            <UIcon name="i-lucide-message-square" class="h-4 w-4 shrink-0" />
            <span>
              Preview: <strong class="font-semibold">{{ namePreview || "(empty name)" }}</strong>
            </span>
          </p>
        </div>

        <div class="border-t border-white/[0.06] pt-5">
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <label class="text-sm font-medium text-white" for="ticket-inactivity">
              Close inactive tickets
            </label>
            <span class="text-sm text-sky-200">
              {{ settings.inactivityHours === 0 ? "Off" : `After ${formatHours(settings.inactivityHours)}` }}
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              v-for="p in inactivityPresets"
              :key="p.hours"
              type="button"
              class="rounded-full px-3 py-1.5 text-xs ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
              :class="
                settings.inactivityHours === p.hours
                  ? 'bg-sky-200/[0.06] text-white ring-2 ring-teal-300/60'
                  : 'text-gray-300 ring-white/10 hover:bg-white/[0.04]'
              "
              @click="settings.inactivityHours = p.hours"
            >
              {{ p.label }}
            </button>
            <UInput
              id="ticket-inactivity"
              v-model.number="settings.inactivityHours"
              type="number"
              :min="0"
              size="sm"
              class="w-24"
              aria-label="Hours of inactivity"
            />
            <span class="text-xs text-gray-400">hours</span>
          </div>
          <p class="mt-2 text-[13px] text-gray-400">
            Tickets with no new messages for this long are closed automatically. 0 turns it off.
          </p>
        </div>
      </div>
    </DashboardModuleSection>

    <!-- ── Staff ── -->
    <DashboardModuleSection
      title="Staff"
      description="These roles are pinged on every new ticket and can view, claim and close any ticket. In a ticket, staff can claim it, set its priority, add or remove members and rename it."
    >
      <div v-if="state.rolesLoading" class="flex items-center gap-2 py-2 text-gray-400">
        <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
        <span class="text-sm">Loading roles…</span>
      </div>
      <USelectMenu
        v-else
        v-model="settings.staffRoleIds"
        :items="roleOptions"
        value-key="value"
        multiple
        searchable
        placeholder="No staff roles"
        icon="i-lucide-users"
        class="w-full"
      />
    </DashboardModuleSection>

    <!-- ── Transcripts ── -->
    <DashboardModuleSection
      title="Transcripts"
      description="A markdown transcript is delivered when a ticket closes."
    >
      <div class="space-y-4">
        <UFormField
          label="Transcript log channel"
          description="The bot posts the transcript here."
          class="w-full"
        >
          <USelectMenu
            v-if="!state.channelsLoading"
            v-model="settings.transcriptChannelId"
            :items="[{ label: 'None', value: '' }, ...channelOptions]"
            value-key="value"
            placeholder="No log channel"
            searchable
            icon="i-lucide-hash"
            class="w-full"
          />
        </UFormField>

        <label
          class="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-white">DM the transcript to the opener</span>
            <span class="block text-[13px] text-gray-400">
              Sends the markdown file directly to whoever opened the ticket.
            </span>
          </span>
          <USwitch v-model="settings.dmTranscript" aria-label="DM the transcript to the opener" />
        </label>
      </div>
    </DashboardModuleSection>

    <!-- ── Web transcripts ── -->
    <DashboardModuleSection
      title="Web transcripts"
      description="Publish a Discord-authenticated transcript page when a ticket closes."
    >
      <div class="space-y-4">
        <label
          class="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-white">Enable web transcripts</span>
            <span class="block text-[13px] text-gray-400">Publish a transcript page on ticket close.</span>
          </span>
          <USwitch v-model="webTranscriptsEnabled" aria-label="Enable web transcripts" />
        </label>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2" :class="webTranscriptsEnabled ? '' : 'opacity-50'">
          <UFormField
            label="Retention"
            description="How long transcripts stay available. Doesn't apply retroactively to closed tickets."
            class="w-full"
          >
            <USelect
              v-model="webTranscriptsRetention"
              :items="retentionItems"
              :disabled="!webTranscriptsEnabled"
              class="w-full"
            />
          </UFormField>

          <UFormField
            label="Attachment size cap"
            description="Larger images are skipped and shown as unavailable."
            class="w-full"
          >
            <USelect
              v-model="webTranscriptsMaxBytes"
              :items="sizeItems"
              :disabled="!webTranscriptsEnabled || !webTranscriptsMirrorAttachments"
              class="w-full"
            />
          </UFormField>
        </div>

        <label
          class="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors"
          :class="webTranscriptsEnabled ? 'cursor-pointer hover:bg-white/[0.04]' : 'cursor-not-allowed opacity-50'"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-white">Mirror image attachments</span>
            <span class="block text-[13px] text-gray-400">
              Re-host images so they stay available after Discord expires them.
            </span>
          </span>
          <USwitch
            v-model="webTranscriptsMirrorAttachments"
            :disabled="!webTranscriptsEnabled"
            aria-label="Mirror image attachments"
          />
        </label>

        <div v-if="webTranscriptsEnabled" class="border-t border-white/[0.06] pt-4">
          <p class="mb-2 text-sm font-medium text-white">Recent transcripts</p>
          <ul v-if="recentTranscripts?.items?.length" class="-mx-2 divide-y divide-white/[0.06]">
            <li v-for="t in recentTranscripts.items" :key="t.id">
              <a
                :href="`/ticket/${t.id}`"
                target="_blank"
                rel="noopener"
                class="flex items-center justify-between gap-3 rounded px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
              >
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium text-white">
                    Ticket #{{ String(t.ticket_id).padStart(4, "0") }} · {{ t.thread_name }}
                  </span>
                  <span class="block text-[13px] text-gray-400">
                    Opened by {{ t.opener_id }} · closed {{ new Date(t.closed_at).toLocaleString() }}
                  </span>
                </span>
                <UIcon name="i-lucide-external-link" class="h-4 w-4 shrink-0 text-gray-400" />
              </a>
            </li>
          </ul>
          <p v-else class="text-[13px] text-gray-400">No transcripts yet.</p>
        </div>
      </div>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="tickets" />

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { nanoid } from "nanoid";
import type { TicketQuestion } from "~/components/dashboard/TicketQuestionsEditor.vue";

const route = useRoute();
const guildId = route.params.guild_id as string;
const {
  state,
  isModuleEnabled,
  saveModuleSettings,
  getModuleConfig,
  loadChannels,
  loadRoles,
  channelOptions,
  roleOptions,
} = useServerSettings(guildId);

const saving = ref(false);

// ── Settings model ──────────────────────────────────────────────────────────

interface TicketTypeForm {
  id: string;
  name: string;
  emoji: string;
  description: string;
  parentChannelId: string;
  staffRoleIds: string[];
  buttonStyle: string;
  questions: TicketQuestion[];
  // The type as stored. Fields this page doesn't edit (like a per-type embed)
  // are passed through on save so they aren't lost.
  raw: Record<string, any>;
}

interface WebTranscriptsForm {
  enabled: boolean;
  retentionDays: number | null;
  mirrorAttachments: boolean;
  attachmentMaxSizeBytes: number;
}

interface TicketsForm {
  panelChannelId: string;
  defaultParentChannelId: string;
  transcriptChannelId: string;
  dmTranscript: boolean;
  maxTicketsPerUser: number;
  namingTemplate: string;
  inactivityHours: number;
  questions: TicketQuestion[];
  types: TicketTypeForm[];
  staffRoleIds: string[];
  panelEmbed: { title: string; description: string; color: string };
  webTranscripts: WebTranscriptsForm;
}

const defaults = (): TicketsForm => ({
  panelChannelId: "",
  defaultParentChannelId: "",
  transcriptChannelId: "",
  dmTranscript: true,
  maxTicketsPerUser: 1,
  namingTemplate: "ticket-{count}-{username}",
  inactivityHours: 0,
  questions: [],
  types: [],
  staffRoleIds: [],
  panelEmbed: { title: "", description: "", color: "#5865F2" },
  webTranscripts: {
    enabled: false,
    retentionDays: 90,
    mirrorAttachments: true,
    attachmentMaxSizeBytes: 8 * 1024 * 1024,
  },
});

const settings = ref<TicketsForm>(defaults());

// Last loaded/saved values (JSON); drives the unsaved-changes bar and Discard.
const baseline = ref(JSON.stringify(settings.value));
const dirty = computed(() => JSON.stringify(settings.value) !== baseline.value);

// ── Constants ────────────────────────────────────────────────────────────────

// Discord's own button colors, so the preview matches what members see.
const buttonStyleOptions = [
  { label: "Blurple", value: "Primary", hex: "#5865F2" },
  { label: "Grey", value: "Secondary", hex: "#4f545c" },
  { label: "Green", value: "Success", hex: "#3ba55d" },
  { label: "Red", value: "Danger", hex: "#ed4245" },
];
const styleHex = (style: string) =>
  buttonStyleOptions.find((o) => o.value === style)?.hex ?? "#5865F2";

const inactivityPresets = [
  { label: "Off", hours: 0 },
  { label: "24 hours", hours: 24 },
  { label: "48 hours", hours: 48 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
];

const formatHours = (h: number) => {
  if (h < 24) return `${h} hour${h !== 1 ? "s" : ""}`;
  const days = Math.floor(h / 24);
  const rest = h % 24;
  return `${days} day${days !== 1 ? "s" : ""}${rest ? ` ${rest}h` : ""}`;
};

// ── Panel preview ────────────────────────────────────────────────────────────

const hasPanelEmbed = computed(
  () => !!(settings.value.panelEmbed.title || settings.value.panelEmbed.description),
);
const namedTypes = computed(() => settings.value.types.filter((t) => t.name.trim()));

// panelMessageId is written by the bot when it posts the panel.
const deployedMessageId = computed(() => getModuleConfig("tickets")?.panelMessageId as string | undefined);

// ── Naming template ──────────────────────────────────────────────────────────

const namingTokens = ["{count}", "{username}", "{type}"];

const insertToken = (token: string) => {
  settings.value.namingTemplate = `${settings.value.namingTemplate}${token}`;
};

const namePreview = computed(() =>
  settings.value.namingTemplate
    .replace(/\{count\}/g, "7")
    .replace(/\{username\}/g, "alex")
    .replace(/\{type\}/g, (namedTypes.value[0]?.name ?? "support").toLowerCase().replace(/\s+/g, "-"))
    .trim(),
);

// ── Web transcripts ───────────────────────────────────────────────────────────

const webTranscriptsEnabled = computed({
  get: () => settings.value.webTranscripts?.enabled ?? false,
  set: (v: boolean) => {
    settings.value.webTranscripts = { ...settings.value.webTranscripts, enabled: v };
  },
});

const webTranscriptsRetention = computed({
  get: () => settings.value.webTranscripts?.retentionDays ?? 90,
  set: (v: number | null) => {
    settings.value.webTranscripts = { ...settings.value.webTranscripts, retentionDays: v };
  },
});

const webTranscriptsMirrorAttachments = computed({
  get: () => settings.value.webTranscripts?.mirrorAttachments ?? true,
  set: (v: boolean) => {
    settings.value.webTranscripts = { ...settings.value.webTranscripts, mirrorAttachments: v };
  },
});

const webTranscriptsMaxBytes = computed({
  get: () => settings.value.webTranscripts?.attachmentMaxSizeBytes ?? 8 * 1024 * 1024,
  set: (v: number) => {
    settings.value.webTranscripts = { ...settings.value.webTranscripts, attachmentMaxSizeBytes: v };
  },
});

const retentionItems = [
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
  { label: "180 days", value: 180 },
  { label: "365 days", value: 365 },
  { label: "Forever", value: null },
];

const sizeItems = [
  { label: "2 MB", value: 2 * 1024 * 1024 },
  { label: "4 MB", value: 4 * 1024 * 1024 },
  { label: "8 MB", value: 8 * 1024 * 1024 },
  { label: "16 MB", value: 16 * 1024 * 1024 },
  { label: "25 MB", value: 25 * 1024 * 1024 },
];

interface TranscriptItem {
  id: string;
  ticket_id: number;
  thread_name: string;
  opener_id: string;
  closed_at: string;
  expires_at: string | null;
  message_count: number;
}

const { data: recentTranscripts } = useFetch<{ items: TranscriptItem[] }>(
  () => `/api/tickets/transcripts/list?guild_id=${route.params.guild_id}`,
  { server: false, default: () => ({ items: [] }) },
);

// ── Types ────────────────────────────────────────────────────────────────────

function addType() {
  settings.value.types.push({
    id: nanoid(8),
    name: "",
    emoji: "",
    description: "",
    parentChannelId: "",
    staffRoleIds: [],
    buttonStyle: "Primary",
    questions: [],
    raw: {},
  });
}

function removeType(index: number) {
  settings.value.types.splice(index, 1);
}

// ── Save ─────────────────────────────────────────────────────────────────────

// Blank questions can't be asked, so they aren't saved. Optional numbers that
// were cleared are dropped.
const cleanQuestions = (qs: TicketQuestion[]) =>
  qs
    .filter((q) => q.label.trim())
    .map((q) => ({
      id: q.id,
      label: q.label.trim(),
      placeholder: q.placeholder?.trim() || undefined,
      required: q.required,
      style: q.style,
      minLength: q.minLength,
      maxLength: q.maxLength,
    }));

const save = async () => {
  saving.value = true;

  const cleanRoleIds = settings.value.staffRoleIds.filter(Boolean);

  const cleanTypes = settings.value.types
    .filter((t) => t.name.trim())
    .map((t) => ({
      ...t.raw,
      id: t.id,
      name: t.name,
      emoji: t.emoji || undefined,
      description: t.description || undefined,
      parentChannelId: t.parentChannelId || undefined,
      staffRoleIds: t.staffRoleIds.filter(Boolean),
      buttonStyle: t.buttonStyle,
      questions: cleanQuestions(t.questions),
    }));

  const ok = await saveModuleSettings("tickets", {
    // The save replaces the module's whole settings blob, so keep every key
    // this page doesn't edit (panelMessageId, etc.).
    ...getModuleConfig("tickets"),
    panelChannelId: settings.value.panelChannelId || undefined,
    defaultParentChannelId: settings.value.defaultParentChannelId || undefined,
    transcriptChannelId: settings.value.transcriptChannelId || undefined,
    dmTranscript: settings.value.dmTranscript,
    maxTicketsPerUser: settings.value.maxTicketsPerUser,
    namingTemplate:
      settings.value.namingTemplate || "ticket-{count}-{username}",
    inactivityHours: settings.value.inactivityHours || 0,
    questions: cleanQuestions(settings.value.questions),
    types: cleanTypes,
    staffRoleIds: cleanRoleIds,
    panelEmbed:
      settings.value.panelEmbed.title || settings.value.panelEmbed.description
        ? settings.value.panelEmbed
        : undefined,
    webTranscripts: settings.value.webTranscripts,
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) baseline.value = JSON.stringify(settings.value);

  saving.value = false;
};

const discard = () => {
  settings.value = JSON.parse(baseline.value);
};

// ── Init ─────────────────────────────────────────────────────────────────────

const toQuestion = (q: any): TicketQuestion => ({
  id: q.id ?? nanoid(8),
  label: q.label ?? "",
  placeholder: q.placeholder ?? "",
  required: q.required ?? true,
  style: q.style === "paragraph" ? "paragraph" : "short",
  minLength: q.minLength,
  maxLength: q.maxLength,
});

onMounted(async () => {
  const saved = getModuleConfig("tickets");
  if (saved && Object.keys(saved).length > 0) {
    settings.value = {
      panelChannelId: saved.panelChannelId ?? "",
      defaultParentChannelId: saved.defaultParentChannelId ?? "",
      transcriptChannelId: saved.transcriptChannelId ?? "",
      dmTranscript: saved.dmTranscript ?? true,
      maxTicketsPerUser: saved.maxTicketsPerUser ?? 1,
      namingTemplate: saved.namingTemplate ?? "ticket-{count}-{username}",
      inactivityHours: saved.inactivityHours ?? 0,
      questions: (saved.questions ?? []).map(toQuestion),
      types: (saved.types ?? []).map((t: any) => ({
        id: t.id ?? nanoid(8),
        name: t.name ?? "",
        emoji: t.emoji ?? "",
        description: t.description ?? "",
        parentChannelId: t.parentChannelId ?? "",
        staffRoleIds: t.staffRoleIds ?? [],
        buttonStyle: t.buttonStyle ?? "Primary",
        questions: (t.questions ?? []).map(toQuestion),
        raw: t,
      })),
      staffRoleIds: saved.staffRoleIds ?? [],
      panelEmbed: {
        title: saved.panelEmbed?.title ?? "",
        description: saved.panelEmbed?.description ?? "",
        color: saved.panelEmbed?.color ?? "#5865F2",
      },
      webTranscripts: {
        enabled: saved.webTranscripts?.enabled ?? false,
        retentionDays: saved.webTranscripts?.retentionDays ?? 90,
        mirrorAttachments: saved.webTranscripts?.mirrorAttachments ?? true,
        attachmentMaxSizeBytes: saved.webTranscripts?.attachmentMaxSizeBytes ?? 8 * 1024 * 1024,
      },
    };
  }
  baseline.value = JSON.stringify(settings.value);

  await Promise.all([loadChannels(), loadRoles()]);
});
</script>
