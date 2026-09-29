<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-badge-check"
      title="Verification Gate"
      description="The panel members use to verify themselves and get a role."
      :enabled="isModuleEnabled('verification')"
    />

    <!-- ── Panel embed ── -->
    <DashboardModuleSection
      title="Panel embed"
      description="The message shown above the verify buttons."
    >
      <div class="space-y-4">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Title" class="w-full">
            <UInput
              v-model="settings.embed.title"
              placeholder="e.g. Welcome to the server!"
              icon="i-lucide-heading"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Accent color" class="w-full">
            <div class="flex items-center gap-2">
              <input
                v-model="settings.embed.color"
                type="color"
                aria-label="Pick accent color"
                class="h-8 w-11 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
              />
              <UInput
                v-model="settings.embed.color"
                placeholder="#5865F2"
                icon="i-lucide-palette"
                class="w-full"
              />
            </div>
          </UFormField>
        </div>

        <UFormField label="Description" class="w-full">
          <UTextarea
            v-model="settings.embed.description"
            placeholder="Welcome! Click the button below to verify yourself and gain access to the server."
            :rows="3"
            autoresize
            class="w-full"
          />
        </UFormField>
      </div>
    </DashboardModuleSection>

    <!-- ── Buttons ── -->
    <DashboardModuleSection
      title="Verify buttons"
      :description="`Each button grants a role when clicked. ${settings.buttons.length} of 25 used, 5 per row.`"
    >
      <template #actions>
        <UButton
          size="sm"
          color="primary"
          variant="soft"
          icon="i-lucide-plus"
          :disabled="settings.buttons.length >= 25"
          @click="addButton"
        >
          Add button
        </UButton>
      </template>

      <div
        v-if="settings.buttons.length === 0"
        class="flex flex-col items-center gap-3 rounded-lg border border-dashed border-white/10 px-6 py-10 text-center"
      >
        <span
          class="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-200/10 ring-1 ring-inset ring-sky-100/20"
        >
          <UIcon name="i-lucide-mouse-pointer-click" class="h-5 w-5 text-sky-200" />
        </span>
        <div>
          <h4 class="text-sm font-semibold text-white">No buttons yet</h4>
          <p class="mt-1 text-[13px] text-gray-400">Add the first verify button to get started.</p>
        </div>
        <UButton color="primary" icon="i-lucide-plus" @click="addButton">Add button</UButton>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="(btn, index) in settings.buttons"
          :key="btn.id"
          class="space-y-4 rounded-xl bg-white/[0.03] p-4 ring-1 ring-inset ring-white/10"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-white">Button {{ index + 1 }}</span>
            <UButton
              color="error"
              variant="ghost"
              size="sm"
              icon="i-lucide-trash-2"
              :aria-label="`Remove button ${index + 1}`"
              @click="removeButton(index)"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
            <UFormField label="Label" class="w-full">
              <UInput
                v-model="btn.label"
                placeholder="e.g. Verify to enter"
                icon="i-lucide-tag"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Emoji" hint="Optional" class="w-full">
              <UInput v-model="btn.emoji" placeholder="✅" icon="i-lucide-smile" class="w-full" />
            </UFormField>
          </div>

          <div>
            <span class="mb-2 block text-sm font-medium text-white">Button color</span>
            <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Button color">
              <label v-for="opt in buttonStyleOptions" :key="opt.value" class="cursor-pointer">
                <input
                  v-model="btn.style"
                  type="radio"
                  :name="`verify-style-${btn.id}`"
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

          <UFormField label="Role to grant" class="w-full">
            <div v-if="state.rolesLoading" class="flex items-center gap-2 py-1.5 text-gray-400">
              <UIcon name="i-lucide-loader-circle" class="h-4 w-4 animate-spin text-sky-200" />
              <span class="text-sm">Loading roles…</span>
            </div>
            <USelectMenu
              v-else-if="roleOptions.length > 0"
              v-model="btn.roleId"
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
            v-if="!state.rolesLoading && roleOptions.length > 0 && !btn.roleId"
            class="flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
          >
            <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
            No role selected. Clicking this button won't grant anything.
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
            v-if="!hasEmbed && settings.buttons.length === 0"
            class="text-sm text-[#949ba4]"
          >
            Nothing to preview yet. Add an embed title or description, or a button.
          </p>
          <template v-else>
            <div
              v-if="hasEmbed"
              class="max-w-md rounded border-l-4 bg-[#2b2d31] p-3"
              :style="{ borderLeftColor: settings.embed.color || '#5865F2' }"
            >
              <p v-if="settings.embed.title" class="text-base font-semibold text-white">
                {{ settings.embed.title }}
              </p>
              <p
                v-if="settings.embed.description"
                class="mt-1 whitespace-pre-line text-sm text-[#dbdee1]"
              >
                {{ settings.embed.description }}
              </p>
            </div>
            <div
              v-for="(row, r) in buttonRows"
              :key="r"
              class="mt-2 flex flex-wrap gap-2 first:mt-0"
              :class="hasEmbed || r > 0 ? 'mt-2' : ''"
            >
              <span
                v-for="btn in row"
                :key="btn.id"
                class="inline-flex select-none items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium text-white"
                :style="{ backgroundColor: styleHex(btn.style) }"
              >
                <span v-if="btn.emoji">{{ btn.emoji }}</span>
                {{ btn.label || "Button" }}
              </span>
            </div>
          </template>
        </div>

        <div>
          <p class="mb-2 text-[13px] text-gray-400">
            Save your settings, then run this in your server to post the panel:
          </p>
          <div class="flex items-center gap-3 rounded-lg bg-black/30 p-3 ring-1 ring-inset ring-white/10">
            <UIcon name="i-lucide-terminal" class="h-4 w-4 shrink-0 text-gray-500" />
            <code class="select-all font-mono text-sm text-teal-300">/verification deploy #channel</code>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-copy"
              class="ml-auto"
              @click="copyCommand('/verification deploy #channel')"
            >
              Copy
            </UButton>
          </div>
          <p class="mt-2 text-[13px] text-gray-400">
            Running it again updates the existing panel in place. If the message was deleted, a new
            one is posted.
          </p>
          <p
            v-if="dirty"
            class="mt-3 flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
          >
            <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
            You have unsaved changes. Save before deploying.
          </p>
        </div>
      </div>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="verification" />

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="save" @discard="discard" />
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

// ── Types ─────────────────────────────────────────────────────────────

interface VerificationButton {
  id: string;
  label: string;
  emoji: string;
  style: "Primary" | "Secondary" | "Success" | "Danger";
  roleId: string;
}

interface VerificationSettingsForm {
  embed: {
    title: string;
    description: string;
    color: string;
  };
  buttons: VerificationButton[];
}

// ── State ─────────────────────────────────────────────────────────────

const settings = reactive<VerificationSettingsForm>({
  embed: { title: "", description: "", color: "#5865F2" },
  buttons: [],
});

// Last loaded/saved values (JSON); drives the unsaved-changes bar and Discard.
const baseline = ref(JSON.stringify(settings));
const dirty = computed(() => JSON.stringify(settings) !== baseline.value);

// ── Constants ─────────────────────────────────────────────────────────

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

const styleHex = (style: string): string =>
  buttonStyleOptions.find((o) => o.value === style)?.hex ?? "#5865F2";

const hasEmbed = computed(
  () => !!(settings.embed.title || settings.embed.description),
);

// Discord lays buttons out 5 per row.
const buttonRows = computed(() => {
  const rows: VerificationButton[][] = [];
  for (let i = 0; i < settings.buttons.length; i += 5) {
    rows.push(settings.buttons.slice(i, i + 5));
  }
  return rows;
});

function addButton() {
  settings.buttons.push({
    id: uid(),
    label: "Verify to Enter",
    emoji: "✅",
    style: "Success",
    roleId: "",
  });
}

function removeButton(index: number) {
  settings.buttons.splice(index, 1);
}

function copyCommand(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    toast.add({ title: "Copied!", color: "success" });
  });
}

// ── Save ──────────────────────────────────────────────────────────────

const save = async () => {
  saving.value = true;
  const ok = await saveModuleSettings("verification", {
    // The save replaces the whole settings blob, so keep the bot-owned deploy
    // keys (verificationChannelId / verificationMessageId) or the next
    // /verification deploy can't edit the panel in place.
    ...getModuleConfig("verification"),
    embed: {
      title: settings.embed.title || undefined,
      description: settings.embed.description || undefined,
      color: settings.embed.color || undefined,
    },
    buttons: settings.buttons.map((b) => ({
      id: b.id,
      label: b.label,
      emoji: b.emoji || undefined,
      style: b.style,
      roleId: b.roleId,
    })),
  });
  // A failed save keeps the form dirty so the bar stays and Save can retry.
  if (ok) baseline.value = JSON.stringify(settings);
  saving.value = false;
};

const discard = () => {
  const b = JSON.parse(baseline.value) as VerificationSettingsForm;
  settings.embed = b.embed;
  settings.buttons = b.buttons;
};

// ── Init ─────────────────────────────────────────────────────────────

onMounted(async () => {
  const saved = getModuleConfig("verification");
  if (saved) {
    if (saved.embed) {
      settings.embed.title = saved.embed.title ?? "";
      settings.embed.description = saved.embed.description ?? "";
      settings.embed.color = saved.embed.color ?? "#5865F2";
    }
    if (Array.isArray(saved.buttons)) {
      settings.buttons = saved.buttons.map((b: any) => ({
        id: b.id ?? uid(),
        label: b.label ?? "Verify to Enter",
        emoji: b.emoji ?? "",
        style: b.style ?? "Success",
        roleId: b.roleId ?? "",
      }));
    }
  }
  baseline.value = JSON.stringify(settings);
  await loadRoles();
});
</script>
