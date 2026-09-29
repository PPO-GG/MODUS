<template>
  <div class="mx-auto max-w-4xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-calendar-days"
      title="Server Events"
      description="Schedule and manage Discord scheduled events."
      :enabled="isModuleEnabled('events')"
    />

    <!-- ── Calendar ── -->
    <DashboardModuleSection
      title="Calendar"
      :description="`${eventsThisMonth.length} event${eventsThisMonth.length !== 1 ? 's' : ''} in ${monthLabel}.`"
    >
      <template #actions>
        <div class="flex items-center gap-1">
          <UButton
            icon="i-lucide-chevron-left"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Previous month"
            @click="prevMonth"
          />
          <UButton color="neutral" variant="ghost" size="sm" @click="goToday">Today</UButton>
          <UButton
            icon="i-lucide-chevron-right"
            color="neutral"
            variant="ghost"
            size="sm"
            aria-label="Next month"
            @click="nextMonth"
          />
          <UButton
            color="primary"
            size="sm"
            icon="i-lucide-calendar-plus"
            class="ml-1"
            @click="openDayModal(new Date())"
          >
            New event
          </UButton>
        </div>
      </template>

      <div class="flex flex-col gap-6 lg:flex-row">
        <!-- Month grid -->
        <div class="min-w-0 flex-[2]">
          <p class="mb-2 text-sm font-medium text-white">{{ monthLabel }}</p>
          <div class="mb-1 grid grid-cols-7 gap-1">
            <div
              v-for="(d, i) in ['S', 'M', 'T', 'W', 'T', 'F', 'S']"
              :key="i"
              class="py-1 text-center text-[11px] uppercase tracking-wider text-gray-400"
            >
              {{ d }}
            </div>
          </div>
          <div class="grid grid-cols-7 gap-1">
            <button
              v-for="cell in calendarCells"
              :key="cell.date.toISOString()"
              type="button"
              class="flex min-h-12 flex-col items-start overflow-hidden rounded-lg p-1 text-left transition-colors focus-visible:outline-2 focus-visible:outline-teal-300 sm:min-h-[4.75rem] sm:p-1.5"
              :class="[
                cell.inCurrentMonth
                  ? 'bg-white/[0.03] ring-1 ring-inset ring-white/10 hover:bg-white/[0.06] hover:ring-sky-200/30'
                  : 'opacity-40 ring-1 ring-inset ring-white/5 hover:opacity-70',
                cell.isToday ? '!ring-2 !ring-teal-300' : '',
              ]"
              :aria-label="`${cell.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}${
                cell.events.length ? `, ${cell.events.length} event${cell.events.length !== 1 ? 's' : ''}` : ''
              }`"
              @click="openDayModal(cell.date)"
            >
              <span
                class="text-xs font-semibold"
                :class="cell.isToday ? 'text-teal-300' : 'text-gray-300'"
              >
                {{ cell.date.getDate() }}
              </span>
              <span class="mt-0.5 hidden w-full space-y-0.5 sm:block">
                <span
                  v-for="ev in cell.events.slice(0, 2)"
                  :key="ev.id"
                  class="block truncate rounded bg-sky-200/15 px-1 text-[10px] leading-tight text-sky-100"
                >
                  {{ ev.name }}
                </span>
                <span v-if="cell.events.length > 2" class="block text-[10px] text-gray-400">
                  +{{ cell.events.length - 2 }} more
                </span>
              </span>
              <span v-if="cell.events.length" class="mt-1 flex gap-0.5 sm:hidden" aria-hidden="true">
                <span
                  v-for="n in Math.min(cell.events.length, 3)"
                  :key="n"
                  class="h-1.5 w-1.5 rounded-full bg-sky-300"
                />
              </span>
            </button>
          </div>
        </div>

        <!-- This month's events -->
        <div class="min-w-0 flex-1 lg:border-l lg:border-white/10 lg:pl-6">
          <p class="mb-2 text-sm font-medium text-white">This month</p>
          <div v-if="loading" class="space-y-2" aria-busy="true">
            <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-white/[0.04]" />
          </div>
          <p v-else-if="eventsThisMonth.length === 0" class="py-4 text-[13px] text-gray-400">
            No events scheduled this month.
          </p>
          <ul v-else class="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            <li v-for="ev in eventsThisMonth" :key="ev.id">
              <button
                type="button"
                class="flex w-full items-start gap-3 rounded-lg bg-white/[0.03] p-2.5 text-left ring-1 ring-inset ring-white/10 transition-colors hover:ring-sky-200/30 focus-visible:outline-2 focus-visible:outline-teal-300"
                @click="openDayModal(new Date(ev.scheduledStartTime))"
              >
                <span class="w-9 shrink-0 text-center">
                  <span class="block text-sm font-bold leading-none text-sky-200">
                    {{ new Date(ev.scheduledStartTime).getDate() }}
                  </span>
                  <span class="block text-[10px] uppercase text-gray-400">
                    {{ new Date(ev.scheduledStartTime).toLocaleDateString("en-US", { month: "short" }) }}
                  </span>
                </span>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium text-white">{{ ev.name }}</span>
                  <span class="block text-[13px] text-gray-400">
                    {{ timeLabel(ev.scheduledStartTime) }} · {{ ev.userCount }} interested
                  </span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </DashboardModuleSection>

    <!-- ── Announcements ── -->
    <DashboardModuleSection
      title="Announcements"
      description="Where new events are announced, and who gets pinged."
    >
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <UFormField
          label="Announcement channel"
          hint="Optional"
          description="Leave empty to skip announcements."
          class="w-full"
        >
          <USelectMenu
            v-model="settings.announcementChannelId"
            :items="channelOptions"
            value-key="value"
            placeholder="No announcement channel"
            searchable
            icon="i-lucide-hash"
            :loading="state.channelsLoading"
            :clear="{ ariaLabel: 'Clear channel selection' }"
            class="w-full"
          />
        </UFormField>

        <UFormField
          label="Notify roles"
          hint="Optional"
          description="Pinged when an event is announced."
          class="w-full"
        >
          <USelectMenu
            v-model="settings.notifyRoleIds"
            :items="roleOptions"
            value-key="value"
            multiple
            placeholder="No roles"
            icon="i-lucide-users"
            :loading="state.rolesLoading"
            class="w-full"
          />
        </UFormField>
      </div>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="events" />

    <DashboardModuleSaveBar
      :dirty="settingsDirty"
      :saving="savingSettings"
      @save="saveSettings"
      @discard="discardSettings"
    />

    <!-- ── Day detail / create / edit modal ── -->
    <UModal
      v-model:open="showDayModal"
      :title="selectedDateLabel"
      description="Events on this day, and a form to add or edit one."
    >
      <template #body>
        <div class="space-y-5">
          <div v-if="selectedDayEvents.length > 0">
            <p class="mb-2 text-sm font-medium text-white">Events on this day</p>
            <ul class="space-y-2">
              <li
                v-for="ev in selectedDayEvents"
                :key="ev.id"
                class="flex items-center gap-2 rounded-lg bg-white/[0.03] p-2.5 ring-1 ring-inset ring-white/10"
                :class="editingEventId === ev.id ? '!ring-2 !ring-teal-300/60' : ''"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-white">{{ ev.name }}</p>
                  <p class="text-[13px] text-gray-400">
                    {{ timeLabel(ev.scheduledStartTime) }} · {{ ev.userCount }} interested
                  </p>
                </div>
                <span
                  v-if="ev.entityType !== 3"
                  class="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-gray-300"
                  title="This event isn't managed by this calendar, so it can't be edited here."
                >
                  Managed in Discord
                </span>
                <UButton
                  v-else
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :aria-label="`Edit ${ev.name}`"
                  @click="startEdit(ev)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="sm"
                  :aria-label="`Delete ${ev.name}`"
                  @click="deleteTarget = ev"
                />
              </li>
            </ul>
          </div>

          <div
            class="space-y-4"
            :class="selectedDayEvents.length > 0 ? 'border-t border-white/[0.06] pt-5' : ''"
          >
            <p class="text-sm font-medium text-white">
              {{ editingEventId ? "Edit event" : "Add an event" }}
            </p>
            <UFormField label="Name" class="w-full">
              <UInput
                v-model="form.name"
                placeholder="e.g. Community game night"
                icon="i-lucide-calendar-days"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Date and time" hint="Your local timezone" class="w-full">
              <UInput v-model="form.datetime" type="datetime-local" class="w-full" />
            </UFormField>
            <p class="-mt-2 text-[13px] text-gray-400">
              {{
                editingEventId
                  ? "Keeps its original length."
                  : "Ends 1 hour after it starts."
              }}
            </p>
            <UFormField label="Location" class="w-full">
              <UInput
                v-model="form.location"
                placeholder="Voice channel, URL or text"
                icon="i-lucide-map-pin"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Description" hint="Optional" class="w-full">
              <UTextarea v-model="form.description" :rows="2" autoresize class="w-full" />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton v-if="editingEventId" variant="ghost" color="neutral" @click="cancelEdit">
            Cancel edit
          </UButton>
          <UButton v-else variant="ghost" color="neutral" @click="showDayModal = false">
            Close
          </UButton>
          <UButton
            color="primary"
            :icon="editingEventId ? 'i-lucide-check' : 'i-lucide-plus'"
            :loading="actionLoading"
            :disabled="!canSubmit"
            @click="submitForm"
          >
            {{ editingEventId ? "Save changes" : "Add event" }}
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
              <h3 class="text-base font-semibold text-white">Delete event</h3>
              <p class="text-[13px] text-gray-400">This can't be undone.</p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            Delete <strong class="text-white">{{ deleteTarget?.name }}</strong> from the server's
            events?
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton color="neutral" variant="ghost" @click="deleteTarget = null">Cancel</UButton>
            <UButton color="error" icon="i-lucide-trash-2" :loading="actionLoading" @click="confirmDelete">
              Delete event
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { CalendarEvent } from "~/composables/useEvents";

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
const { events, eventsByDay, loading, actionLoading, fetchEvents, createEvent, updateEvent, deleteEvent } =
  useEvents(guildId);

// ── Settings ──
const settings = ref({
  announcementChannelId: "" as string,
  notifyRoleIds: [] as string[],
});
const savingSettings = ref(false);

// Cleared selects can come back as null/undefined, so compare a normalised copy.
const snapshot = () =>
  JSON.stringify({
    announcementChannelId: settings.value.announcementChannelId || "",
    notifyRoleIds: [...(settings.value.notifyRoleIds ?? [])],
  });
const settingsBaseline = ref(snapshot());
const settingsDirty = computed(() => snapshot() !== settingsBaseline.value);

const saveSettings = async () => {
  savingSettings.value = true;
  const ok = await saveModuleSettings("events", {
    announcementChannelId: settings.value.announcementChannelId || undefined,
    notifyRoleIds: settings.value.notifyRoleIds,
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) settingsBaseline.value = snapshot();
  savingSettings.value = false;
};

const discardSettings = () => {
  const b = JSON.parse(settingsBaseline.value);
  settings.value = {
    announcementChannelId: b.announcementChannelId,
    notifyRoleIds: [...b.notifyRoleIds],
  };
};

// ── Calendar ──
const viewDate = ref(new Date());

const monthLabel = computed(() =>
  viewDate.value.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
);

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

interface CalendarCell {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

const calendarCells = computed<CalendarCell[]>(() => {
  const year = viewDate.value.getFullYear();
  const month = viewDate.value.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  const today = new Date();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    cells.push({
      date,
      inCurrentMonth: date.getMonth() === month,
      isToday: date.toDateString() === today.toDateString(),
      events: eventsByDay.value.get(date.toDateString()) || [],
    });
  }
  return cells;
});

const eventsThisMonth = computed(() => {
  const year = viewDate.value.getFullYear();
  const month = viewDate.value.getMonth();
  return events.value
    .filter((e) => {
      const d = new Date(e.scheduledStartTime);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .sort(
      (a, b) =>
        new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime(),
    );
});

function prevMonth() {
  viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() - 1, 1);
}
function nextMonth() {
  viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + 1, 1);
}
function goToday() {
  viewDate.value = new Date();
}

// ── Day modal ──
const showDayModal = ref(false);
const selectedDate = ref<Date | null>(null);
const editingEventId = ref<string | null>(null);
const toast = useToast();

const selectedDateLabel = computed(() =>
  selectedDate.value
    ? selectedDate.value.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : "",
);

const selectedDayEvents = computed(() =>
  selectedDate.value ? eventsByDay.value.get(selectedDate.value.toDateString()) || [] : [],
);

const form = ref({
  name: "",
  datetime: "",
  location: "",
  description: "",
});

const canSubmit = computed(
  () => !!form.value.name.trim() && !!form.value.datetime && !!form.value.location.trim(),
);

/** Format an ISO timestamp as a `datetime-local` input value, in the browser's local time. */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resetForm(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  form.value = {
    name: "",
    datetime: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T19:00`,
    location: "",
    description: "",
  };
  editingEventId.value = null;
}

function openDayModal(date: Date) {
  selectedDate.value = date;
  resetForm(date);
  showDayModal.value = true;
}

function startEdit(ev: CalendarEvent) {
  editingEventId.value = ev.id;
  form.value = {
    name: ev.name,
    datetime: toDatetimeLocalValue(ev.scheduledStartTime),
    location: ev.location || "",
    description: ev.description || "",
  };
}

function cancelEdit() {
  if (selectedDate.value) resetForm(selectedDate.value);
}

/**
 * Compute the end time for the submitted start time. When editing an
 * existing event, preserve its original duration instead of forcing a flat
 * 1-hour window (which would silently truncate multi-hour events). New
 * events default to 1 hour.
 */
function computeEndDate(startDate: Date): Date {
  if (editingEventId.value) {
    const original = events.value.find((e) => e.id === editingEventId.value);
    if (original?.scheduledEndTime) {
      const originalStart = new Date(original.scheduledStartTime).getTime();
      const originalEnd = new Date(original.scheduledEndTime).getTime();
      const duration = originalEnd - originalStart;
      if (duration > 0) return new Date(startDate.getTime() + duration);
    }
  }
  return new Date(startDate.getTime() + 60 * 60 * 1000);
}

async function submitForm() {
  if (!canSubmit.value) {
    toast.add({
      title: "Missing fields",
      description: "Name, date/time, and location are required.",
      color: "error",
    });
    return;
  }

  const startDate = new Date(form.value.datetime);
  const endDate = computeEndDate(startDate);

  try {
    if (editingEventId.value) {
      await updateEvent(editingEventId.value, {
        name: form.value.name,
        description: form.value.description || undefined,
        scheduled_start_time: startDate.toISOString(),
        scheduled_end_time: endDate.toISOString(),
        location: form.value.location,
      });
      toast.add({ title: "Event updated", color: "success" });
    } else {
      await createEvent({
        name: form.value.name,
        description: form.value.description || undefined,
        scheduled_start_time: startDate.toISOString(),
        scheduled_end_time: endDate.toISOString(),
        location: form.value.location,
      });
      toast.add({ title: "Event created", color: "success" });
    }
    if (selectedDate.value) resetForm(selectedDate.value);
  } catch {
    // Error toast already shown by useEvents.
  }
}

// ── Delete ──
const deleteTarget = ref<CalendarEvent | null>(null);

async function confirmDelete() {
  const ev = deleteTarget.value;
  if (!ev) return;
  try {
    await deleteEvent(ev.id);
    toast.add({ title: "Event deleted", color: "success" });
    if (editingEventId.value === ev.id && selectedDate.value) resetForm(selectedDate.value);
    deleteTarget.value = null;
  } catch {
    // Error toast already shown by useEvents.
  }
}

onMounted(() => {
  const saved = getModuleConfig("events");
  if (saved && Object.keys(saved).length > 0) {
    settings.value = {
      announcementChannelId: saved.announcementChannelId ?? "",
      notifyRoleIds: saved.notifyRoleIds ?? [],
    };
  }
  settingsBaseline.value = snapshot();
  loadChannels();
  loadRoles();
  fetchEvents();
});
</script>
