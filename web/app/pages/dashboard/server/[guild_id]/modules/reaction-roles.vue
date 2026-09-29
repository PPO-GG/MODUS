<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-smile-plus"
      title="Button Roles"
      description="Panels with buttons or a dropdown that members use to toggle roles."
      :enabled="isModuleEnabled('reaction-roles')"
    />

    <!-- ── Panel picker ── -->
    <div v-if="settings.panels.length > 0" class="flex flex-wrap items-center gap-2" role="tablist" aria-label="Panels">
      <button
        v-for="panel in settings.panels"
        :key="panel.id"
        type="button"
        role="tab"
        :aria-selected="selectedPanelId === panel.id"
        class="inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-1.5 text-sm ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300"
        :class="
          selectedPanelId === panel.id
            ? 'bg-sky-200/10 text-white ring-2 ring-teal-300/60'
            : 'text-gray-400 ring-white/10 hover:bg-white/[0.04] hover:text-gray-200'
        "
        @click="selectedPanelId = panel.id"
      >
        <UIcon :name="typeIcon(panel.type)" class="h-4 w-4 shrink-0" />
        <span class="truncate">{{ panel.name || "Unnamed panel" }}</span>
        <span
          v-if="panel.messageId"
          class="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
          title="Deployed"
        />
      </button>
      <UButton
        color="primary"
        variant="soft"
        size="sm"
        icon="i-lucide-plus"
        @click="showAddPanel = true"
      >
        New panel
      </UButton>
    </div>

    <!-- ── Empty state ── -->
    <DashboardModuleSection v-if="settings.panels.length === 0" title="Panels">
      <div
        class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
        >
          <UIcon name="i-lucide-mouse-pointer-click" class="h-5 w-5 text-sky-200" />
        </span>
        <div>
          <h4 class="text-sm font-semibold text-white">No panels yet</h4>
          <p class="mx-auto mt-1 max-w-sm text-[13px] text-gray-400">
            A panel is a message with buttons or a dropdown. Members click to give themselves a
            role, click again to remove it.
          </p>
        </div>
        <UButton color="primary" icon="i-lucide-plus" @click="showAddPanel = true">
          Create your first panel
        </UButton>
      </div>
    </DashboardModuleSection>

    <template v-if="selectedPanel">
      <!-- ── Panel ── -->
      <DashboardModuleSection title="Panel" description="The panel's name and how members pick roles.">
        <template #actions>
          <UButton
            color="error"
            variant="ghost"
            size="sm"
            icon="i-lucide-trash-2"
            @click="deleteTarget = selectedPanel"
          >
            Delete
          </UButton>
        </template>

        <div class="space-y-5">
          <UFormField label="Panel name" class="w-full">
            <UInput
              v-model="selectedPanel.name"
              placeholder="e.g. Game Roles"
              icon="i-lucide-tag"
              class="w-full"
            />
          </UFormField>
          <p
            v-if="isDuplicateName(selectedPanel)"
            class="flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
          >
            <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
            <span>
              Another panel has this name. <code class="font-mono">/buttonroles deploy</code> looks
              panels up by name, so only the first one can be deployed.
            </span>
          </p>

          <div>
            <span class="mb-2 block text-sm font-medium text-white">Panel type</span>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Panel type">
              <label v-for="opt in panelTypeOptions" :key="opt.value" class="block cursor-pointer">
                <input
                  v-model="selectedPanel.type"
                  type="radio"
                  name="panel-type"
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
                    <span class="block text-sm font-semibold text-white">{{ opt.label }}</span>
                    <span class="block text-[13px] leading-relaxed text-gray-400">
                      {{ opt.description }}
                    </span>
                  </span>
                  <UIcon
                    v-if="selectedPanel.type === opt.value"
                    name="i-lucide-circle-check"
                    class="h-5 w-5 shrink-0 text-teal-300"
                  />
                </div>
              </label>
            </div>
          </div>
        </div>
      </DashboardModuleSection>

      <!-- ── Embed ── -->
      <DashboardModuleSection title="Embed" description="The message shown above the panel.">
        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField label="Title" class="w-full">
              <UInput
                v-model="selectedPanel.embed.title"
                placeholder="e.g. Choose your roles"
                icon="i-lucide-heading"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Accent color" class="w-full">
              <div class="flex items-center gap-2">
                <input
                  v-model="selectedPanel.embed.color"
                  type="color"
                  aria-label="Pick accent color"
                  class="h-8 w-11 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
                />
                <UInput
                  v-model="selectedPanel.embed.color"
                  placeholder="#5865F2"
                  icon="i-lucide-palette"
                  class="w-full"
                />
              </div>
            </UFormField>
          </div>
          <UFormField label="Description" class="w-full">
            <UTextarea
              v-model="selectedPanel.embed.description"
              placeholder="Select a role from the options below."
              :rows="2"
              autoresize
              class="w-full"
            />
          </UFormField>
        </div>
      </DashboardModuleSection>

      <!-- ── Entries ── -->
      <DashboardModuleSection
        :title="entryPlural"
        :description="`${selectedPanel.entries.length} of 25 used${selectedPanel.type === 'buttons' ? ', 5 per row' : ''}.`"
      >
        <template #actions>
          <UButton
            size="sm"
            color="primary"
            variant="soft"
            icon="i-lucide-plus"
            :disabled="selectedPanel.entries.length >= 25"
            @click="addEntry"
          >
            Add {{ entrySingular.toLowerCase() }}
          </UButton>
        </template>

        <div
          v-if="selectedPanel.entries.length === 0"
          class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-8 text-center"
        >
          <p class="text-[13px] text-gray-400">
            No {{ entryPlural.toLowerCase() }} yet. Each one gives members a role.
          </p>
          <UButton color="primary" icon="i-lucide-plus" @click="addEntry">
            Add {{ entrySingular.toLowerCase() }}
          </UButton>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="(entry, idx) in selectedPanel.entries"
            :key="entry.id"
            class="space-y-4 rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/10"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-white">{{ entrySingular }} {{ idx + 1 }}</span>
              <UButton
                color="error"
                variant="ghost"
                size="sm"
                icon="i-lucide-trash-2"
                :aria-label="`Remove ${entrySingular.toLowerCase()} ${idx + 1}`"
                @click="removeEntry(idx)"
              />
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
              <UFormField label="Label" class="w-full">
                <UInput
                  v-model="entry.label"
                  placeholder="e.g. Gamer"
                  icon="i-lucide-tag"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Emoji" hint="Optional" class="w-full">
                <UInput v-model="entry.emoji" placeholder="🎮" icon="i-lucide-smile" class="w-full" />
              </UFormField>
            </div>

            <div v-if="selectedPanel.type === 'buttons'">
              <span class="mb-2 block text-sm font-medium text-white">Button color</span>
              <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Button color">
                <label v-for="opt in buttonStyleOptions" :key="opt.value" class="cursor-pointer">
                  <input
                    v-model="entry.style"
                    type="radio"
                    :name="`entry-style-${entry.id}`"
                    :value="opt.value"
                    class="peer sr-only"
                  />
                  <span
                    class="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.04] peer-checked:bg-sky-200/[0.06] peer-checked:text-white peer-checked:ring-2 peer-checked:ring-teal-300/60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-300"
                  >
                    <span
                      class="h-3 w-3 rounded-full"
                      :style="{ backgroundColor: opt.hex }"
                      aria-hidden="true"
                    />
                    {{ opt.label }}
                  </span>
                </label>
              </div>
            </div>

            <UFormField label="Role" class="w-full">
              <div v-if="state.rolesLoading" class="flex items-center gap-2 py-1.5 text-gray-400">
                <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
                <span class="text-sm">Loading roles…</span>
              </div>
              <USelectMenu
                v-else-if="roleOptions.length > 0"
                v-model="entry.roleId"
                :items="roleOptions"
                value-key="value"
                placeholder="Select a role…"
                searchable
                icon="i-lucide-users"
                class="w-full"
              />
              <p v-else class="py-1.5 text-sm italic text-gray-500">No roles available.</p>
            </UFormField>
            <p
              v-if="!state.rolesLoading && roleOptions.length > 0 && !entry.roleId"
              class="flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
            >
              <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
              No role selected. This {{ entrySingular.toLowerCase() }} won't grant anything.
            </p>
          </div>
        </div>
      </DashboardModuleSection>

      <!-- ── Preview & deploy ── -->
      <DashboardModuleSection
        title="Preview & deploy"
        description="This is how the panel will look in Discord."
      >
        <div class="space-y-4">
          <div class="rounded-xl bg-[#313338] p-4">
            <p
              v-if="!hasEmbed && selectedPanel.entries.length === 0"
              class="text-sm text-[#949ba4]"
            >
              Nothing to preview yet. Add an embed title or description, or an entry.
            </p>
            <template v-else>
              <div
                v-if="hasEmbed"
                class="max-w-md rounded border-l-4 bg-[#2b2d31] p-3"
                :style="{ borderLeftColor: selectedPanel.embed.color || '#5865F2' }"
              >
                <p v-if="selectedPanel.embed.title" class="text-base font-semibold text-white">
                  {{ selectedPanel.embed.title }}
                </p>
                <p
                  v-if="selectedPanel.embed.description"
                  class="mt-1 whitespace-pre-line text-sm text-[#dbdee1]"
                >
                  {{ selectedPanel.embed.description }}
                </p>
              </div>

              <template v-if="selectedPanel.type === 'buttons'">
                <div
                  v-for="(row, r) in buttonRows"
                  :key="r"
                  class="flex flex-wrap gap-2"
                  :class="hasEmbed || r > 0 ? 'mt-2' : ''"
                >
                  <span
                    v-for="entry in row"
                    :key="entry.id"
                    class="inline-flex select-none items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium text-white"
                    :style="{ backgroundColor: styleHex(entry.style) }"
                  >
                    <span v-if="entry.emoji">{{ entry.emoji }}</span>
                    {{ entry.label || "Button" }}
                  </span>
                </div>
              </template>
              <div
                v-else-if="selectedPanel.entries.length > 0"
                class="max-w-sm overflow-hidden rounded bg-[#1e1f22] ring-1 ring-black/40"
                :class="hasEmbed ? 'mt-2' : ''"
              >
                <p class="px-3 pt-2 text-[11px] uppercase tracking-wide text-[#949ba4]">
                  Dropdown options
                </p>
                <div
                  v-for="entry in selectedPanel.entries"
                  :key="entry.id"
                  class="flex items-center gap-2 px-3 py-2 text-sm text-[#dbdee1]"
                >
                  <span v-if="entry.emoji">{{ entry.emoji }}</span>
                  {{ entry.label || "Option" }}
                </div>
              </div>
            </template>
          </div>

          <div>
            <p class="mb-2 text-[13px] text-gray-400">
              Save your changes, then run this in your server:
            </p>
            <div class="flex items-center gap-3 rounded-lg bg-black/30 p-3 ring-1 ring-inset ring-white/10">
              <UIcon name="i-lucide-terminal" class="h-4 w-4 shrink-0 text-gray-500" />
              <code class="min-w-0 select-all break-all font-mono text-sm text-teal-300">{{
                deployCommand
              }}</code>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-copy"
                class="ml-auto shrink-0"
                @click="copyCommand(deployCommand)"
              >
                Copy
              </UButton>
            </div>

            <p
              v-if="dirty"
              class="mt-3 flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
            >
              <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
              You have unsaved changes. Save before deploying.
            </p>
            <p
              v-else-if="selectedPanel.messageId"
              class="mt-3 flex items-center gap-2 rounded-lg bg-emerald-400/[0.08] px-3 py-2 text-[13px] text-emerald-300"
            >
              <UIcon name="i-lucide-circle-check" class="h-4 w-4 shrink-0" />
              Deployed. Changes here reach Discord when you run the command again, which updates
              the message in place.
            </p>
            <p v-else class="mt-3 text-[13px] text-gray-400">Not deployed yet.</p>
          </div>
        </div>
      </DashboardModuleSection>
    </template>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="reaction-roles" />

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />

    <!-- ── New panel ── -->
    <UModal v-model:open="showAddPanel" title="Create new panel" description="You can change both later.">
      <template #body>
        <div class="space-y-5">
          <UFormField label="Panel name" class="w-full">
            <UInput
              v-model="newPanel.name"
              placeholder="e.g. Game Roles"
              icon="i-lucide-tag"
              class="w-full"
              autofocus
              @keydown.enter="createPanel"
            />
          </UFormField>

          <div>
            <span class="mb-2 block text-sm font-medium text-white">Panel type</span>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Panel type">
              <label v-for="opt in panelTypeOptions" :key="opt.value" class="block cursor-pointer">
                <input
                  v-model="newPanel.type"
                  type="radio"
                  name="new-panel-type"
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
                    <span class="block text-sm font-semibold text-white">{{ opt.label }}</span>
                    <span class="block text-[13px] leading-relaxed text-gray-400">
                      {{ opt.description }}
                    </span>
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="showAddPanel = false">Cancel</UButton>
          <UButton
            color="primary"
            icon="i-lucide-plus"
            :disabled="!newPanel.name.trim()"
            @click="createPanel"
          >
            Create panel
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
              <h3 class="text-base font-semibold text-white">Delete panel</h3>
              <p class="text-[13px] text-gray-400">
                Applies when you save.
              </p>
            </div>
          </div>
          <p class="text-sm text-gray-300">
            Delete <strong class="text-white">{{ deleteTarget?.name || "this panel" }}</strong>?
          </p>
          <p
            v-if="deleteTarget?.messageId"
            class="flex items-start gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
          >
            <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This panel is deployed. Its message stays in Discord, and members who click it will
              see "interaction failed". Delete the message in Discord too.
            </span>
          </p>
          <div class="flex justify-end gap-2 pt-1">
            <UButton color="neutral" variant="ghost" @click="deleteTarget = null">Cancel</UButton>
            <UButton color="error" icon="i-lucide-trash-2" @click="confirmDeletePanel">
              Delete panel
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from "vue";

const toast = useToast();
const route = useRoute();
const guildId = route.params.guild_id as string;
const {
  state,
  isModuleEnabled,
  saveModuleSettings,
  getModuleConfig,
  loadRoles,
  roleOptions,
} = useServerSettings(guildId);

const saving = ref(false);
const showAddPanel = ref(false);
const selectedPanelId = ref<string | null>(null);
const deleteTarget = ref<RolePanel | null>(null);

// ── Types ────────────────────────────────────────────────────────────

interface PanelEmbed {
  title: string;
  description: string;
  color: string;
}

interface RoleEntry {
  id: string;
  label: string;
  emoji: string;
  style: "Primary" | "Secondary" | "Success" | "Danger";
  roleId: string;
}

interface RolePanel {
  id: string;
  name: string;
  channelId?: string;
  messageId?: string;
  type: "buttons" | "dropdown";
  embed: PanelEmbed;
  entries: RoleEntry[];
}

interface ButtonRolesForm {
  panels: RolePanel[];
}

// ── State ────────────────────────────────────────────────────────────

const settings = reactive<ButtonRolesForm>({ panels: [] });

// Last loaded/saved values (JSON); drives the unsaved-changes bar and Discard.
const baseline = ref(JSON.stringify(settings));
const dirty = computed(() => JSON.stringify(settings) !== baseline.value);

const newPanel = reactive({
  name: "",
  type: "buttons" as "buttons" | "dropdown",
});

const selectedPanel = computed<RolePanel | null>(() => {
  if (!selectedPanelId.value) return null;
  return settings.panels.find((p) => p.id === selectedPanelId.value) ?? null;
});

// ── Constants ────────────────────────────────────────────────────────

const panelTypeOptions = [
  {
    value: "buttons",
    label: "Buttons",
    description: "Each role gets its own button. Up to 25 buttons, 5 per row.",
    icon: "i-lucide-layout-grid",
  },
  {
    value: "dropdown",
    label: "Dropdown",
    description: "Members pick roles from a select menu. Up to 25 options.",
    icon: "i-lucide-circle-chevron-down",
  },
];

// Discord's own button colors, so the preview matches what members see.
const buttonStyleOptions = [
  { label: "Blurple", value: "Primary", hex: "#5865F2" },
  { label: "Grey", value: "Secondary", hex: "#4f545c" },
  { label: "Green", value: "Success", hex: "#3ba55d" },
  { label: "Red", value: "Danger", hex: "#ed4245" },
];

// ── Helpers ───────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const typeIcon = (type: string) =>
  panelTypeOptions.find((o) => o.value === type)?.icon ?? "i-lucide-layout-grid";

const styleHex = (style: string): string =>
  buttonStyleOptions.find((o) => o.value === style)?.hex ?? "#5865F2";

const entrySingular = computed(() =>
  selectedPanel.value?.type === "dropdown" ? "Option" : "Button",
);
const entryPlural = computed(() =>
  selectedPanel.value?.type === "dropdown" ? "Options" : "Buttons",
);

const hasEmbed = computed(
  () => !!(selectedPanel.value?.embed.title || selectedPanel.value?.embed.description),
);

// Discord lays buttons out 5 per row.
const buttonRows = computed(() => {
  const entries = selectedPanel.value?.entries ?? [];
  const rows: RoleEntry[][] = [];
  for (let i = 0; i < entries.length; i += 5) rows.push(entries.slice(i, i + 5));
  return rows;
});

// /buttonroles deploy looks panels up by name (case-insensitive), first match wins.
const isDuplicateName = (panel: RolePanel): boolean => {
  const name = panel.name.trim().toLowerCase();
  return (
    !!name &&
    settings.panels.some((p) => p.id !== panel.id && p.name.trim().toLowerCase() === name)
  );
};

const deployCommand = computed(
  () =>
    `/buttonroles deploy panel:${selectedPanel.value?.name.trim() || "<name>"} channel:#channel`,
);

function copyCommand(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.add({ title: "Copied!", color: "success" });
  });
}

function createPanel() {
  if (!newPanel.name.trim()) return;
  const panel: RolePanel = {
    id: uid(),
    name: newPanel.name.trim(),
    type: newPanel.type,
    embed: { title: "", description: "", color: "#5865F2" },
    entries: [],
  };
  settings.panels.push(panel);
  selectedPanelId.value = panel.id;
  newPanel.name = "";
  newPanel.type = "buttons";
  showAddPanel.value = false;
}

function confirmDeletePanel() {
  const id = deleteTarget.value?.id;
  deleteTarget.value = null;
  if (!id) return;
  const idx = settings.panels.findIndex((p) => p.id === id);
  if (idx > -1) {
    settings.panels.splice(idx, 1);
    selectedPanelId.value = settings.panels[0]?.id ?? null;
  }
}

function addEntry() {
  if (!selectedPanel.value) return;
  selectedPanel.value.entries.push({
    id: uid(),
    label: "",
    emoji: "",
    style: "Primary",
    roleId: "",
  });
}

function removeEntry(index: number) {
  selectedPanel.value?.entries.splice(index, 1);
}

// ── Save ─────────────────────────────────────────────────────────────

const save = async () => {
  saving.value = true;
  const ok = await saveModuleSettings("reaction-roles", {
    panels: settings.panels.map((p) => ({
      id: p.id,
      name: p.name,
      channelId: p.channelId,
      messageId: p.messageId,
      type: p.type,
      embed: {
        title: p.embed.title || undefined,
        description: p.embed.description || undefined,
        color: p.embed.color || undefined,
      },
      entries: p.entries.map((e) => ({
        id: e.id,
        label: e.label,
        emoji: e.emoji || undefined,
        style: e.style,
        roleId: e.roleId,
      })),
    })),
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) baseline.value = JSON.stringify(settings);
  saving.value = false;
};

const discard = () => {
  const b = JSON.parse(baseline.value) as ButtonRolesForm;
  settings.panels = b.panels;
  if (!settings.panels.some((p) => p.id === selectedPanelId.value)) {
    selectedPanelId.value = settings.panels[0]?.id ?? null;
  }
};

// ── Init ─────────────────────────────────────────────────────────────

onMounted(async () => {
  const saved = getModuleConfig("reaction-roles");
  if (saved?.panels && Array.isArray(saved.panels)) {
    settings.panels = saved.panels.map((p: any) => ({
      id: p.id ?? uid(),
      name: p.name ?? "Unnamed Panel",
      channelId: p.channelId,
      messageId: p.messageId,
      type: p.type ?? "buttons",
      embed: {
        title: p.embed?.title ?? "",
        description: p.embed?.description ?? "",
        color: p.embed?.color ?? "#5865F2",
      },
      entries: (p.entries ?? []).map((e: any) => ({
        id: e.id ?? uid(),
        label: e.label ?? "",
        emoji: e.emoji ?? "",
        style: e.style ?? "Primary",
        roleId: e.roleId ?? "",
      })),
    }));
    if (settings.panels.length > 0) {
      selectedPanelId.value = settings.panels[0]!.id;
    }
  }
  baseline.value = JSON.stringify(settings);
  await loadRoles();
});
</script>
