<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-gift"
      title="Giveaways"
      description="Giveaways with entry requirements and structured prizes."
      :enabled="isModuleEnabled('giveaways')"
    />

    <p
      v-if="error"
      class="flex items-start gap-2 rounded-lg bg-red-400/[0.08] px-3 py-2 text-[13px] text-red-300"
      role="alert"
    >
      <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
      {{ error }}
    </p>

    <!-- ── Current giveaways ── -->
    <DashboardModuleSection
      title="Current giveaways"
      :description="
        loading
          ? 'Loading giveaways…'
          : `${currentGiveaways.length} running.`
      "
    >
      <template #actions>
        <UButton color="primary" size="sm" icon="i-lucide-plus" @click="openCreate">
          New giveaway
        </UButton>
      </template>

      <div v-if="loading" class="space-y-2" aria-busy="true">
        <div v-for="i in 2" :key="i" class="h-28 animate-pulse rounded-lg bg-white/[0.04]" />
      </div>

      <div
        v-else-if="currentGiveaways.length === 0"
        class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-8 text-center"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
        >
          <UIcon name="i-lucide-gift" class="h-5 w-5 text-sky-200" />
        </span>
        <div>
          <h4 class="text-sm font-semibold text-white">No giveaways running</h4>
          <p class="mt-1 text-[13px] text-gray-400">Start one and members can enter from Discord.</p>
        </div>
        <UButton color="primary" icon="i-lucide-plus" @click="openCreate">New giveaway</UButton>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="g in currentGiveaways"
          :key="g.id"
          class="space-y-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/10"
        >
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-white">{{ g.title }}</p>
              <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-gray-400">
                <span class="inline-flex items-center gap-1 text-teal-300">
                  <UIcon name="i-lucide-clock" class="h-3.5 w-3.5" />
                  {{ timeLeft(g.endsAt) }}
                </span>
                <span>ends {{ formatDate(g.endsAt) }}</span>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-pencil"
                :aria-label="`Edit ${g.title}`"
                @click="openEdit(g)"
              />
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-circle-x"
                :aria-label="`Cancel ${g.title}`"
                @click="cancelTarget = g"
              />
            </div>
          </div>

          <div class="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <div class="rounded-lg bg-white/[0.04] p-3">
              <div class="text-xs text-gray-400">Prize</div>
              <div class="mt-0.5 break-words font-medium text-white">{{ prizeText(g) }}</div>
            </div>
            <div class="rounded-lg bg-white/[0.04] p-3">
              <div class="text-xs text-gray-400">Entered ({{ g.entrantCount }})</div>
              <div class="mt-0.5 break-words font-medium text-white">{{ memberList(g.entrants, g.entrantCount) }}</div>
            </div>
            <div class="rounded-lg bg-white/[0.04] p-3">
              <div class="text-xs text-gray-400">Winners</div>
              <div class="mt-0.5 font-medium text-white">{{ g.winnerCount }}</div>
            </div>
          </div>
        </div>
      </div>
    </DashboardModuleSection>

    <!-- ── Past giveaways ── -->
    <DashboardModuleSection
      title="Past giveaways"
      :description="`${pastGiveaways.length} finished or cancelled.`"
    >
      <p v-if="pastGiveaways.length === 0" class="text-[13px] text-gray-400">
        Finished and cancelled giveaways show up here.
      </p>

      <ul v-else class="-mx-2 divide-y divide-white/[0.06]">
        <li v-for="g in pastGiveaways" :key="g.id" class="flex items-start gap-3 px-2 py-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate text-sm font-medium text-white">{{ g.title }}</p>
              <span
                class="rounded-full px-2 py-0.5 text-[11px]"
                :class="
                  g.status === 'ended'
                    ? 'bg-white/[0.06] text-gray-300'
                    : 'bg-amber-400/10 text-amber-300'
                "
              >
                {{ g.status === "ended" ? "Ended" : "Cancelled" }}
              </span>
            </div>
            <p class="mt-0.5 text-[13px] text-gray-400">
              {{ formatDate(g.endsAt) }} · {{ g.entrantCount }} entered ·
              {{ prizeText(g) }}
            </p>
            <p class="mt-0.5 break-words text-[13px] text-gray-300">
              <span class="text-gray-400">Winners:</span>
              {{ g.winners.length ? g.winners.map(memberLabel).join(", ") : "none" }}
            </p>
          </div>
          <UButton
            color="error"
            variant="ghost"
            size="sm"
            icon="i-lucide-trash-2"
            :aria-label="`Delete record for ${g.title}`"
            @click="deleteTarget = g"
          />
        </li>
      </ul>
    </DashboardModuleSection>

    <!-- ── Host roles ── -->
    <DashboardModuleSection
      title="Host roles"
      description="Roles allowed to create and manage giveaways. Admins and members with Manage Server always can."
    >
      <div class="space-y-4">
        <div v-if="state.rolesLoading" class="flex items-center gap-2 py-2 text-gray-400">
          <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
          <span class="text-sm">Loading roles…</span>
        </div>
        <USelectMenu
          v-else-if="roleOptions.length > 0"
          v-model="hostRoleIds"
          :items="roleOptions"
          value-key="value"
          multiple
          placeholder="No host roles"
          icon="i-lucide-users"
          class="w-full"
        />
        <p v-else class="text-sm italic text-gray-500">No roles available.</p>

        <div class="flex justify-end">
          <UButton
            color="primary"
            icon="i-lucide-check"
            :loading="savingHosts"
            :disabled="!hostsDirty"
            @click="saveHostRoles"
          >
            Save host roles
          </UButton>
        </div>
      </div>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="giveaways" />

    <!-- ── Create / edit slide-over ── -->
    <USlideover
      v-model:open="showEditor"
      :title="editingId ? 'Edit giveaway' : 'New giveaway'"
      :description="
        editingId
          ? 'Changes update the giveaway message in Discord.'
          : 'Posts the giveaway in the channel you pick.'
      "
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div class="space-y-6">
          <DashboardModuleSection title="Basics">
            <div class="space-y-4">
              <UFormField v-if="!editingId" label="Channel" class="w-full">
                <USelectMenu
                  v-if="channelOptions.length > 0"
                  v-model="form.channel_id"
                  :items="channelOptions"
                  value-key="value"
                  placeholder="Select a channel"
                  searchable
                  icon="i-lucide-hash"
                  class="w-full"
                />
                <p v-else class="py-2 text-sm italic text-gray-500">No channels available.</p>
              </UFormField>

              <UFormField label="Title" class="w-full">
                <UInput
                  v-model="form.title"
                  placeholder="e.g. Nitro giveaway"
                  maxlength="200"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Winners" class="w-full sm:w-40">
                <UInput
                  v-model.number="form.winner_count"
                  type="number"
                  :min="1"
                  :max="50"
                  class="w-full"
                />
              </UFormField>

              <div>
                <div class="mb-2 flex items-baseline justify-between gap-3">
                  <label class="text-sm font-medium text-white" for="giveaway-duration">
                    {{ editingId ? "New duration" : "Duration" }}
                  </label>
                  <span class="text-xs text-gray-400">
                    {{
                      durationMinutes
                        ? formatMinutes(durationMinutes)
                        : editingId
                          ? "Keeps the current end time"
                          : "Minimum 5 minutes"
                    }}
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <button
                    v-for="p in durationPresets"
                    :key="p.minutes"
                    type="button"
                    class="rounded-full px-3 py-1.5 text-xs ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
                    :class="
                      durationMinutes === p.minutes
                        ? 'bg-sky-200/[0.06] text-white ring-2 ring-teal-300/60'
                        : 'text-gray-300 ring-white/10 hover:bg-white/[0.04]'
                    "
                    @click="form.duration_minutes = p.minutes"
                  >
                    {{ p.label }}
                  </button>
                  <UInput
                    id="giveaway-duration"
                    v-model.number="form.duration_minutes"
                    type="number"
                    :min="5"
                    size="sm"
                    class="w-24"
                    :placeholder="editingId ? 'Keep' : ''"
                    aria-label="Duration in minutes"
                  />
                  <span class="text-xs text-gray-400">minutes</span>
                </div>
                <p v-if="editingId" class="mt-2 text-[13px] text-gray-400">
                  Counted from now. Leave it blank to keep the current end time.
                </p>
              </div>
            </div>
          </DashboardModuleSection>

          <DashboardModuleSection title="Prize">
            <div class="space-y-4">
              <div>
                <span class="mb-2 block text-sm font-medium text-white">Prize type</span>
                <div
                  class="grid grid-cols-2 gap-2 sm:grid-cols-4"
                  role="radiogroup"
                  aria-label="Prize type"
                >
                  <label
                    v-for="k in prizeKinds"
                    :key="k.value"
                    class="block"
                    :class="editingId ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'"
                  >
                    <input
                      v-model="form.prize_kind"
                      type="radio"
                      name="giveaway-prize-kind"
                      :value="k.value"
                      :disabled="!!editingId"
                      class="peer sr-only"
                    />
                    <span
                      class="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center text-xs text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-checked:bg-sky-200/[0.06] peer-checked:text-white peer-checked:ring-2 peer-checked:ring-teal-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
                    >
                      <UIcon :name="k.icon" class="h-5 w-5 text-sky-200" />
                      {{ k.label }}
                    </span>
                  </label>
                </div>
                <p v-if="editingId" class="mt-2 text-[13px] text-gray-400">
                  The prize type can't be changed after creation. Cancel and create a new giveaway
                  instead.
                </p>
              </div>

              <UFormField
                label="Prize value"
                :description="
                  editingId && form.prize_kind === 'key'
                    ? 'Leave blank to keep the existing code.'
                    : 'The code or item shown to the winners.'
                "
                class="w-full"
              >
                <UInput
                  v-model="form.prize_value"
                  :placeholder="
                    editingId && form.prize_kind === 'key'
                      ? 'Unchanged'
                      : 'Prize value or code'
                  "
                  maxlength="500"
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Description" hint="Optional" class="w-full">
                <UTextarea
                  v-model="form.description"
                  placeholder="Tell entrants what they're winning"
                  :rows="2"
                  autoresize
                  class="w-full"
                />
              </UFormField>

              <UFormField label="Image URL" hint="Optional" class="w-full">
                <UInput
                  v-model="form.image_url"
                  placeholder="https://…"
                  icon="i-lucide-image"
                  class="w-full"
                />
              </UFormField>
            </div>
          </DashboardModuleSection>

          <DashboardModuleSection
            title="Entry requirements"
            description="All optional. Leave everything empty to let anyone enter."
          >
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField label="Required roles" class="w-full">
                <USelectMenu
                  v-model="form.required_role_ids"
                  :items="roleOptions"
                  value-key="value"
                  multiple
                  placeholder="Any role can enter"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Blocked roles" class="w-full">
                <USelectMenu
                  v-model="form.blocked_role_ids"
                  :items="roleOptions"
                  value-key="value"
                  multiple
                  placeholder="No roles blocked"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Min. account age" hint="days" class="w-full">
                <UInput
                  v-model.number="form.min_account_age_days"
                  type="number"
                  :min="0"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Min. server age" hint="days" class="w-full">
                <UInput
                  v-model.number="form.min_server_age_days"
                  type="number"
                  :min="0"
                  class="w-full"
                />
              </UFormField>
            </div>
          </DashboardModuleSection>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="showEditor = false">Cancel</UButton>
          <UButton
            color="primary"
            :icon="editingId ? 'i-lucide-check' : 'i-lucide-gift'"
            :loading="actionLoading"
            :disabled="!canSubmit"
            @click="submit"
          >
            {{ editingId ? "Save changes" : "Post giveaway" }}
          </UButton>
        </div>
      </template>
    </USlideover>

    <!-- ── Cancel confirmation ── -->
    <UModal :open="!!cancelTarget" @update:open="(v: boolean) => !v && (cancelTarget = null)">
      <template #content>
        <div class="space-y-4 p-6">
          <div class="flex items-center gap-3">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-400/10 ring-1 ring-inset ring-red-400/30"
            >
              <UIcon name="i-lucide-circle-x" class="h-5 w-5 text-red-300" />
            </span>
            <div>
              <h3 class="text-base font-semibold text-white">Cancel giveaway</h3>
              <p class="text-[13px] text-gray-400">This can't be undone.</p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            Cancel <strong class="text-white">{{ cancelTarget?.title }}</strong>? Entries so far
            won't turn into a draw.
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton color="neutral" variant="ghost" @click="cancelTarget = null">
              Keep running
            </UButton>
            <UButton color="error" icon="i-lucide-circle-x" :loading="actionLoading" @click="confirmCancel">
              Cancel giveaway
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- ── Delete record confirmation ── -->
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
              <h3 class="text-base font-semibold text-white">Delete record</h3>
              <p class="text-[13px] text-gray-400">The Discord message stays.</p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            Remove <strong class="text-white">{{ deleteTarget?.title }}</strong> from the
            dashboard history?
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton color="neutral" variant="ghost" @click="deleteTarget = null">Cancel</UButton>
            <UButton color="error" icon="i-lucide-trash-2" :loading="actionLoading" @click="confirmDelete">
              Delete record
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import type { Giveaway, GiveawayMember } from "~/composables/useGiveaways";

const route = useRoute();
const guildId = route.params.guild_id as string;

const { state, isModuleEnabled, loadChannels, loadRoles, channelOptions, roleOptions, getModuleConfig, saveModuleSettings } =
  useServerSettings(guildId);
const { giveaways, loading, actionLoading, error, createGiveaway, updateGiveaway, cancelGiveaway, deleteGiveaway } =
  useGiveaways(guildId);

const currentGiveaways = computed(() => giveaways.value.filter((g) => g.status === "active"));
const pastGiveaways = computed(() => giveaways.value.filter((g) => g.status !== "active"));

// ── Formatting ──

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

const timeLeft = (value: string) => {
  const remaining = new Date(value).getTime() - Date.now();
  if (remaining <= 0) return "Ending soon";
  const minutes = Math.floor(remaining / 60000);
  if (minutes < 60) return `${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days}d ${hours % 24}h left` : `${hours}h ${minutes % 60}m left`;
};

const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h${mins ? ` ${mins}m` : ""}`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d${remHours ? ` ${remHours}h` : ""}${mins ? ` ${mins}m` : ""}`;
};

const memberLabel = (member: GiveawayMember) => {
  if (member.displayName === member.id) return member.id;
  if (member.username && member.username !== member.displayName) {
    return `${member.displayName} (@${member.username})`;
  }
  return member.displayName;
};

// The list endpoint returns every entrant, so cap what's printed.
const memberList = (members: GiveawayMember[], total: number) => {
  if (members.length === 0) return "No entries yet";
  const shown = members.slice(0, 8).map(memberLabel).join(", ");
  return total > 8 ? `${shown} and ${total - 8} more` : shown;
};

const prizeKinds = [
  { value: "key", label: "Key / code", icon: "i-lucide-key-round" },
  { value: "gift", label: "Gift", icon: "i-lucide-gift" },
  { value: "physical", label: "Physical item", icon: "i-lucide-package" },
  { value: "other", label: "Other", icon: "i-lucide-trophy" },
] as const;

const prizeText = (g: Giveaway) =>
  g.prizeValue || prizeKinds.find((k) => k.value === g.prizeKind)?.label || g.prizeKind;

// ── Host roles ──

const hostRoleIds = ref<string[]>([]);
const hostBaseline = ref<string[]>([]);
const savingHosts = ref(false);
const hostsDirty = computed(
  () => JSON.stringify([...hostRoleIds.value].sort()) !== JSON.stringify([...hostBaseline.value].sort()),
);

const saveHostRoles = async () => {
  savingHosts.value = true;
  // The save replaces the module's whole settings blob, so keep any other keys.
  const ok = await saveModuleSettings("giveaways", {
    ...getModuleConfig("giveaways"),
    hostRoleIds: hostRoleIds.value,
  });
  if (ok) hostBaseline.value = [...hostRoleIds.value];
  savingHosts.value = false;
};

// ── Create / edit ──

const durationPresets = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "6 hours", minutes: 360 },
  { label: "1 day", minutes: 1440 },
  { label: "3 days", minutes: 4320 },
  { label: "1 week", minutes: 10080 },
];

type PrizeKind = Giveaway["prizeKind"];

const blankForm = () => ({
  channel_id: "",
  title: "",
  duration_minutes: 60 as number | string | undefined,
  winner_count: 1 as number | string,
  prize_kind: "gift" as PrizeKind,
  prize_value: "",
  description: "",
  image_url: "",
  required_role_ids: [] as string[],
  blocked_role_ids: [] as string[],
  min_account_age_days: undefined as number | string | undefined,
  min_server_age_days: undefined as number | string | undefined,
});

const showEditor = ref(false);
const editingId = ref<string | null>(null);
const form = reactive(blankForm());

// A cleared number input yields "" — treat that as "not set".
const num = (v: unknown): number | undefined =>
  v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v);

const durationMinutes = computed(() => num(form.duration_minutes));

const openCreate = () => {
  editingId.value = null;
  Object.assign(form, blankForm());
  showEditor.value = true;
};

const openEdit = (g: Giveaway) => {
  editingId.value = g.id;
  Object.assign(form, {
    channel_id: g.channelId,
    title: g.title,
    duration_minutes: undefined, // blank = keep the current end time
    winner_count: g.winnerCount,
    prize_kind: g.prizeKind,
    prize_value: g.prizeValue ?? "",
    description: g.description ?? "",
    image_url: g.imageUrl ?? "",
    required_role_ids: [...g.requirements.requiredRoleIds],
    blocked_role_ids: [...g.requirements.blockedRoleIds],
    min_account_age_days: g.requirements.minAccountAgeDays,
    min_server_age_days: g.requirements.minServerAgeDays,
  });
  showEditor.value = true;
};

const canSubmit = computed(() => {
  if (!form.title.trim()) return false;
  const winners = num(form.winner_count);
  if (!winners || winners < 1 || winners > 50) return false;
  const duration = durationMinutes.value;
  if (editingId.value) return duration === undefined || duration >= 5;
  return !!form.channel_id && !!form.prize_value.trim() && duration !== undefined && duration >= 5;
});

const submit = async () => {
  try {
    if (editingId.value) {
      const payload: Record<string, any> = {
        title: form.title,
        description: form.description,
        prize_value: form.prize_value,
        image_url: form.image_url,
        winner_count: num(form.winner_count),
        required_role_ids: form.required_role_ids,
        blocked_role_ids: form.blocked_role_ids,
        min_account_age_days: num(form.min_account_age_days),
        min_server_age_days: num(form.min_server_age_days),
      };
      // prize_kind is not editable (the API ignores it), so it isn't sent.
      if (durationMinutes.value !== undefined) payload.duration_minutes = durationMinutes.value;
      await updateGiveaway(editingId.value, payload);
    } else {
      await createGiveaway({
        channel_id: form.channel_id,
        title: form.title,
        duration_minutes: durationMinutes.value!,
        winner_count: num(form.winner_count)!,
        prize_kind: form.prize_kind,
        prize_value: form.prize_value,
        description: form.description,
        image_url: form.image_url,
        required_role_ids: form.required_role_ids,
        blocked_role_ids: form.blocked_role_ids,
        min_account_age_days: num(form.min_account_age_days),
        min_server_age_days: num(form.min_server_age_days),
      });
    }
    showEditor.value = false;
  } catch {
    // createGiveaway / updateGiveaway re-throw after populating `error`, which
    // the banner at the top of the page shows. The editor stays open so
    // nothing is lost.
  }
};

// ── Cancel / delete ──

const cancelTarget = ref<Giveaway | null>(null);
const deleteTarget = ref<Giveaway | null>(null);

const confirmCancel = async () => {
  const target = cancelTarget.value;
  if (!target) return;
  try {
    await cancelGiveaway(target.id);
    cancelTarget.value = null;
  } catch {
    // cancelGiveaway re-throws after populating `error` — see submit.
  }
};

const confirmDelete = async () => {
  const target = deleteTarget.value;
  if (!target) return;
  try {
    await deleteGiveaway(target.id);
    deleteTarget.value = null;
  } catch {
    // deleteGiveaway re-throws after populating `error` — see submit.
  }
};

onMounted(async () => {
  loadChannels();
  await loadRoles();
  const ids = getModuleConfig("giveaways").hostRoleIds;
  hostRoleIds.value = Array.isArray(ids) ? [...ids] : [];
  hostBaseline.value = [...hostRoleIds.value];
});
</script>
