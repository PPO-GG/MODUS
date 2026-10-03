<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-wand-sparkles"
      title="Permission Presets"
      description="Apply a ready-made permission setup to many channels at once. You'll see exactly what changes before anything is written."
    />

    <div v-if="optionsLoading" class="space-y-3" aria-busy="true">
      <div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-xl bg-white/[0.04]" />
    </div>

    <div
      v-else-if="optionsError"
      class="flex flex-col items-center gap-3 rounded-xl bg-white/[0.03] p-10 text-center ring-1 ring-inset ring-white/10"
      role="alert"
    >
      <UIcon name="i-lucide-triangle-alert" class="h-8 w-8 text-amber-300" />
      <p class="text-sm text-gray-200">{{ optionsError }}</p>
      <UButton color="neutral" variant="soft" size="sm" @click="loadOptions()">Try again</UButton>
    </div>

    <template v-else>
      <!-- 1. Preset -->
      <section class="space-y-3" aria-labelledby="step-preset">
        <h3 id="step-preset" class="text-sm font-semibold text-white">1. Choose a preset</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="p in PRESETS"
            :key="p.id"
            type="button"
            :aria-pressed="presetId === p.id"
            class="rounded-xl p-4 text-left ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
            :class="
              presetId === p.id
                ? 'bg-sky-200/10 ring-sky-100/30'
                : 'bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]'
            "
            @click="setPreset(p.id)"
          >
            <span class="block text-sm font-semibold text-white">{{ p.label }}</span>
            <span class="mt-1 block text-xs text-gray-400">{{ p.description }}</span>
          </button>
        </div>
      </section>

      <!-- 2. Slot roles -->
      <section
        v-for="slot in preset.slots"
        :key="slot.key"
        class="space-y-2"
        :aria-labelledby="`slot-${slot.key}`"
      >
        <h3 :id="`slot-${slot.key}`" class="text-sm font-semibold text-white">
          2. {{ slot.label }}
          <span class="font-normal text-gray-400">
            ({{ slot.min === 0 ? "optional" : `at least ${slot.min}` }}, up to {{ slot.max }})
          </span>
        </h3>
        <USelectMenu
          :model-value="slots[slot.key] ?? []"
          :items="roleItems"
          value-key="value"
          multiple
          placeholder="Choose roles…"
          class="w-full sm:w-96"
          :aria-label="slot.label"
          @update:model-value="(v: string[]) => setSlot(slot.key, v)"
        />
        <p v-if="presetId === 'private-to-roles'" class="text-xs text-gray-400">
          Include the bot's own role if a module (logging, tickets…) uses these channels, or the preview
          will block the change.
        </p>
      </section>

      <!-- 3. Channels -->
      <section class="space-y-3" aria-labelledby="step-channels">
        <h3 id="step-channels" class="text-sm font-semibold text-white">
          3. Choose channels
          <span class="font-normal text-gray-400">
            ({{ channelIds.length }} of {{ MAX_PRESET_CHANNELS }} selected)
          </span>
        </h3>
        <p v-if="eligibleChannels.length === 0" class="text-sm text-gray-400">
          This preset has no channels it can be applied to in this server.
        </p>
        <div v-else class="space-y-4">
          <div
            v-for="group in channelGroups"
            :key="group.category?.id ?? 'none'"
            class="rounded-xl bg-[rgba(3,7,18,0.55)] p-4 ring-1 ring-inset ring-white/10"
          >
            <UCheckbox
              v-if="group.category"
              :model-value="channelIds.includes(group.category.id)"
              :label="group.category.name"
              :disabled="isDisabled(group.category)"
              class="mb-2 font-semibold"
              @update:model-value="(v) => toggleChannel(group.category!.id, v)"
            />
            <p v-else class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              No category
            </p>
            <div class="space-y-1 pl-1" :class="group.category ? 'ml-6' : ''">
              <UCheckbox
                v-for="c in group.channels"
                :key="c.id"
                :model-value="channelIds.includes(c.id)"
                :label="channelLabel(c)"
                :disabled="isDisabled(c)"
                @update:model-value="(v) => toggleChannel(c.id, v)"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Preview -->
      <section class="space-y-2" aria-labelledby="step-preview">
        <h3 id="step-preview" class="text-sm font-semibold text-white">4. Preview</h3>
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            color="primary"
            icon="i-lucide-eye"
            :disabled="!validation.ok"
            @click="openPreview()"
          >
            Preview changes
          </UButton>
          <p v-if="!validation.ok" class="text-xs text-gray-400">{{ validation.error }}</p>
        </div>
      </section>
    </template>

    <DashboardPermissionPresetModal
      :state="preview"
      :preset-label="preset.label"
      :has-category="hasCategory"
      @confirm="onConfirm"
      @close="closePreview"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";
import { MAX_PRESET_CHANNELS, PRESETS, kindAllowed } from "#shared/permission-presets";
import type { ChannelOption } from "~/composables/usePermissionPresets";

const route = useRoute();
const toast = useToast();
const guildId = route.params.guild_id as string;

const {
  presetId, slots, channelIds,
  roles, botTopPosition, channels, optionsLoading, optionsError,
  preset, eligibleChannels, validation,
  preview, lastApply,
  loadOptions, setPreset, setSlot, toggleChannel, openPreview, confirmApply, closePreview,
} = usePermissionPresets(guildId);

const roleItems = computed(() =>
  roles.value.map((r) => ({
    label:
      r.name +
      (r.managed ? " (integration)" : "") +
      (botTopPosition.value !== null && r.position > botTopPosition.value
        ? " — above the bot's top role"
        : ""),
    value: r.id,
  })),
);

const channelGroups = computed(() =>
  groupChannels(channels.value).filter(
    (g) => (g.category && kindAllowed(preset.value, g.category.type)) || g.channels.some((c) => kindAllowed(preset.value, c.type)),
  ),
);

const hasCategory = computed(() =>
  channelIds.value.some((id) => channels.value.find((c) => c.id === id)?.type === 4),
);

const isDisabled = (c: ChannelOption) =>
  !kindAllowed(preset.value, c.type) ||
  (!channelIds.value.includes(c.id) && channelIds.value.length >= MAX_PRESET_CHANNELS);

const channelLabel = (c: ChannelOption) => (c.type === 2 ? `🔊 ${c.name}` : `# ${c.name}`);

const onConfirm = async () => {
  if (await confirmApply()) {
    if (lastApply.value?.logged === false) {
      toast.add({
        title: "Preset applied, but not logged",
        description: "The previous values could not be saved to the Server Logs.",
        color: "warning",
      });
    } else {
      toast.add({
        title: "Preset applied",
        description: "The previous values were saved to the Server Logs.",
        color: "success",
      });
    }
  }
};

onMounted(() => loadOptions());
</script>
