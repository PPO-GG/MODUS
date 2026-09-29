<template>
  <USlideover
    v-model:open="isOpen"
    title="Edit webhook"
    :description="trigger?.name || ''"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #body>
      <div class="space-y-6">
        <!-- ── Basics ── -->
        <DashboardModuleSection title="Basics">
          <div class="space-y-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField label="Name" class="w-full">
                <UInput
                  v-model="triggerName"
                  placeholder="Webhook name"
                  icon="i-lucide-tag"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Provider" class="w-full">
                <USelectMenu
                  v-model="triggerProvider"
                  :items="webhookProviders"
                  value-key="value"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="Post in channel" class="w-full">
              <USelectMenu
                v-if="channelOptions && channelOptions.length > 0"
                v-model="triggerChannelId"
                :items="channelOptions"
                value-key="value"
                placeholder="Select a channel"
                searchable
                icon="i-lucide-hash"
                class="w-full"
              />
              <UInput v-else v-model="triggerChannelId" placeholder="Channel ID" class="w-full" />
            </UFormField>

            <label
              class="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
            >
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-white">Active</span>
                <span class="block text-[13px] text-gray-400">
                  Turn off to stop posting without deleting the webhook.
                </span>
              </span>
              <USwitch v-model="triggerEnabled" aria-label="Active" />
            </label>
          </div>
        </DashboardModuleSection>

        <!-- ── Sample payload ── -->
        <DashboardModuleSection
          title="Sample payload"
          description="Paste a real payload to test filters and preview the embed. It isn't saved."
        >
          <UTextarea
            v-model="sampleJson"
            placeholder='{ "content": "Something happened" }'
            :rows="7"
            class="w-full font-mono text-xs"
            :ui="{ base: 'w-full font-mono text-xs' }"
          />
          <p v-if="jsonError" class="mt-2 flex items-center gap-1.5 text-[13px] text-red-300">
            <UIcon name="i-lucide-triangle-alert" class="h-4 w-4" />
            That isn't valid JSON.
          </p>
        </DashboardModuleSection>

        <!-- ── Embed template ── -->
        <DashboardModuleSection
          title="Embed"
          description="What gets posted. Use {key.name} to insert values from the payload."
        >
          <div class="space-y-4">
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_14rem]">
              <UFormField label="Title" class="w-full">
                <UInput
                  v-model="templateTitle"
                  placeholder="e.g. Alert: {content}"
                  class="w-full"
                  @focus="lastFocusedField = 'title'"
                />
              </UFormField>
              <UFormField label="Accent color" class="w-full">
                <div class="flex items-center gap-2">
                  <input
                    v-model="templateColor"
                    type="color"
                    aria-label="Pick accent color"
                    class="h-8 w-11 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
                  />
                  <UInput
                    v-model="templateColor"
                    placeholder="#5865f2"
                    icon="i-lucide-palette"
                    class="w-full font-mono"
                  />
                </div>
              </UFormField>
            </div>

            <UFormField label="Description" class="w-full">
              <UTextarea
                v-model="templateDesc"
                placeholder="Markdown supported…"
                :rows="4"
                autoresize
                class="w-full"
                @focus="lastFocusedField = 'description'"
              />
            </UFormField>

            <div v-if="detectedFields.length > 0">
              <div class="mb-2 flex items-baseline justify-between gap-3">
                <span class="text-sm font-medium text-white">Fields in your payload</span>
                <span class="text-[13px] text-gray-400">
                  Click to insert into
                  <span class="text-sky-200">{{
                    lastFocusedField === "description" ? "Description" : "Title"
                  }}</span>
                </span>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="field in detectedFields"
                  :key="field.path"
                  type="button"
                  class="group inline-flex max-w-full items-center gap-2 rounded-md bg-white/5 px-2.5 py-1 text-left ring-1 ring-inset ring-white/10 transition-colors hover:bg-sky-200/10 hover:ring-sky-200/30 focus-visible:outline-2 focus-visible:outline-teal-300"
                  @click="insertField(field.path)"
                >
                  <code class="shrink-0 font-mono text-[11px] text-sky-200">{{
                    "{" + field.path + "}"
                  }}</code>
                  <span class="truncate text-[11px] text-gray-500">{{ field.preview }}</span>
                </button>
              </div>
            </div>

            <div>
              <span class="mb-2 block text-sm font-medium text-white">Preview</span>
              <div class="rounded-xl bg-[#313338] p-4">
                <EmbedPreview :form="previewForm" />
              </div>
            </div>
          </div>
        </DashboardModuleSection>

        <!-- ── Filters ── -->
        <DashboardModuleSection
          title="Filters"
          description="Only post when the payload matches every rule. With no rules, everything is posted."
        >
          <template #actions>
            <div class="flex items-center gap-2">
              <span
                v-if="parsedSample && filters.length > 0"
                class="rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
                :class="
                  filterPasses
                    ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25'
                    : 'bg-red-400/10 text-red-300 ring-red-400/25'
                "
              >
                Sample {{ filterPasses ? "passes" : "fails" }}
              </span>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-plus"
                @click="addFilter"
              >
                Add rule
              </UButton>
            </div>
          </template>

          <div
            v-if="filters.length === 0"
            class="rounded-lg border border-dashed border-white/10 p-4 text-center text-[13px] text-gray-400"
          >
            No filters. All payloads will be posted.
          </div>

          <div v-else class="space-y-2">
            <div v-for="(f, i) in filters" :key="i" class="flex flex-wrap items-center gap-2">
              <UInput
                v-model="f.key"
                placeholder="Key (e.g. content)"
                class="min-w-40 flex-1 font-mono"
              />
              <span class="text-xs text-gray-500">equals</span>
              <UInput
                v-model="f.value"
                placeholder="Value (e.g. *error*)"
                class="min-w-40 flex-1 font-mono"
              />
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                size="sm"
                :aria-label="`Remove rule ${i + 1}`"
                @click="removeFilter(i)"
              />
            </div>
            <p class="pt-1 text-[13px] text-gray-400">
              Use <code class="text-gray-300">*</code> as a wildcard, for example
              <code class="text-gray-300">*text*</code> matches any string containing "text". Deep
              paths like <code class="text-gray-300">data.error</code> work too.
            </p>
          </div>
        </DashboardModuleSection>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="isOpen = false">Cancel</UButton>
        <UButton color="primary" icon="i-lucide-check" :loading="saving" @click="save">
          Save changes
        </UButton>
      </div>
    </template>
  </USlideover>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { TriggerDocument } from '~/composables/useTriggers';
import EmbedPreview from '~/components/EmbedPreview.vue';
import { webhookProviders } from '~/utils/webhook-providers';

const props = defineProps<{
  trigger: TriggerDocument | null;
  channelOptions?: { label: string; value: string }[];
}>();

const isOpen = defineModel<boolean>('open', { default: false });
const emit = defineEmits(['save']);

// General Settings
const triggerName = ref("");
const triggerProvider = ref("webhook");
const triggerChannelId = ref("");
const triggerEnabled = ref(true);

const DEFAULT_SAMPLE = "{\n  \"content\": \"Example payload\"\n}";
const sampleJson = ref(DEFAULT_SAMPLE);
const jsonError = ref(false);

const parsedSample = computed(() => {
  if (!sampleJson.value.trim()) return {};
  try {
    jsonError.value = false;
    return JSON.parse(sampleJson.value);
  } catch {
    jsonError.value = true;
    return null;
  }
});

// Filters
const filters = ref<{key: string, value: string}[]>([]);

const addFilter = () => { filters.value.push({ key: '', value: '' }); };
const removeFilter = (idx: number) => { filters.value.splice(idx, 1); };

// Template
const templateTitle = ref("");
const templateDesc = ref("");
const templateColor = ref("#5865f2");

const lastFocusedField = ref<'title' | 'description'>('title');

const saving = ref(false);

// Walk parsed JSON and emit a flat list of leaf paths with previewable values.
function flattenLeaves(value: any, prefix = "", out: { path: string; preview: string }[] = [], depth = 0): { path: string; preview: string }[] {
  if (out.length >= 40 || depth > 6) return out;
  if (value === null || value === undefined) {
    if (prefix) out.push({ path: prefix, preview: String(value) });
    return out;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      if (prefix) out.push({ path: prefix, preview: '[]' });
      return out;
    }
    // Only descend into the first element to avoid index explosions.
    flattenLeaves(value[0], `${prefix}[0]`, out, depth + 1);
    return out;
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      flattenLeaves(value[key], prefix ? `${prefix}.${key}` : key, out, depth + 1);
      if (out.length >= 40) break;
    }
    return out;
  }
  if (prefix) {
    let preview = String(value);
    if (preview.length > 40) preview = preview.slice(0, 37) + '…';
    out.push({ path: prefix, preview });
  }
  return out;
}

const detectedFields = computed(() => {
  if (!parsedSample.value || typeof parsedSample.value !== 'object') return [];
  return flattenLeaves(parsedSample.value);
});

function insertField(path: string) {
  const token = `{${path}}`;
  if (lastFocusedField.value === 'description') {
    templateDesc.value = templateDesc.value ? `${templateDesc.value} ${token}` : token;
  } else {
    templateTitle.value = templateTitle.value ? `${templateTitle.value} ${token}` : token;
  }
}

// Initialize when opened
watch(() => isOpen.value, (val) => {
  if (val && props.trigger) {
    triggerName.value = props.trigger.name || "";
    triggerProvider.value = props.trigger.provider || "webhook";
    triggerChannelId.value = props.trigger.channel_id || "";
    triggerEnabled.value = props.trigger.enabled ?? true;
    // Don't carry one webhook's sample payload over to the next.
    sampleJson.value = DEFAULT_SAMPLE;

    // Load filters
    try {
      if (props.trigger.filters) {
        const f = JSON.parse(props.trigger.filters);
        filters.value = Object.entries(f).map(([key, value]) => ({ key, value: String(value) }));
      } else {
        filters.value = [];
      }
    } catch {
      filters.value = [];
    }

    // Load template
    try {
      if (props.trigger.embed_template) {
        const t = JSON.parse(props.trigger.embed_template);
        templateTitle.value = t.title || "";
        templateDesc.value = t.description || "";
        templateColor.value = t.color ? '#' + t.color.toString(16).padStart(6, '0') : "#5865f2";
      } else {
        templateTitle.value = "";
        templateDesc.value = "";
        templateColor.value = "#5865f2";
      }
    } catch {
      templateTitle.value = "";
      templateDesc.value = "";
      templateColor.value = "#5865f2";
    }
  }
});

// Frontend evaluation logic matching backend
function resolveNestedPath(data: any, path: string): any {
  if (!data) return undefined;
  if (path in data) return data[path];
  const keys = path.split(".");
  let value: any = data;
  for (const key of keys) {
    if (value == null || typeof value !== "object") return undefined;
    value = value[key];
  }
  return value;
}

function resolvePlaceholders(template: string, data: any): string {
  if (!data) return template;
  return template.replace(/\{([^}]+)\}/g, (match, path) => {
    const val = resolveNestedPath(data, path);
    return val != null ? String(val) : match;
  });
}

const filterPasses = computed(() => {
  if (!parsedSample.value) return false;
  if (filters.value.length === 0) return true;

  for (const f of filters.value) {
    if (!f.key) continue;
    const actual = resolveNestedPath(parsedSample.value, f.key);
    const expected = f.value;

    let match = false;
    if (actual === expected) {
      match = true;
    } else if (typeof actual === "string" && typeof expected === "string") {
      const expectedLower = expected.toLowerCase();
      const actualLower = actual.toLowerCase();
      if (expectedLower.startsWith("*") && expectedLower.endsWith("*")) {
        match = actualLower.includes(expectedLower.slice(1, -1));
      } else if (expectedLower.startsWith("*")) {
        match = actualLower.endsWith(expectedLower.slice(1));
      } else if (expectedLower.endsWith("*")) {
        match = actualLower.startsWith(expectedLower.slice(0, -1));
      }
    }
    if (!match) return false;
  }
  return true;
});

const previewForm = computed(() => {
  const data = parsedSample.value || {};

  let previewTitle = templateTitle.value ? resolvePlaceholders(templateTitle.value, data) : undefined;
  let previewDesc = templateDesc.value ? resolvePlaceholders(templateDesc.value, data) : undefined;

  // Build inline embed fields from detected leaves when no template content is set,
  // so the preview shows a real embed instead of a raw JSON code block.
  let fields: { name: string; value: string; inline: boolean }[] = [];
  if (!previewTitle && !previewDesc) {
    previewTitle = "🔔 Webhook Triggered";
    fields = detectedFields.value.slice(0, 25).map((f) => ({
      name: f.path,
      value: f.preview || '—',
      inline: f.preview.length <= 24,
    }));
  }

  return {
    title: previewTitle,
    description: previewDesc,
    color: templateColor.value,
    fields,
    authorName: undefined,
    authorIconUrl: undefined,
    authorUrl: undefined,
    imageUrl: undefined,
    thumbnailUrl: undefined,
    footerText: undefined,
    footerIconUrl: undefined,
    showTimestamp: true
  } as any;
});

const save = async () => {
  saving.value = true;

  const finalFilters = {} as Record<string, string>;
  for (const f of filters.value) {
    if (f.key) finalFilters[f.key] = f.value;
  }

  const finalTemplate = {} as any;
  if (templateTitle.value) finalTemplate.title = templateTitle.value;
  if (templateDesc.value) finalTemplate.description = templateDesc.value;

  // Parse color hex back to integer
  if (templateColor.value) {
    const hexStr = templateColor.value.replace('#', '');
    if (hexStr) {
      finalTemplate.color = parseInt(hexStr, 16);
    }
  }

  emit('save', {
    name: triggerName.value,
    provider: triggerProvider.value,
    channel_id: triggerChannelId.value,
    enabled: triggerEnabled.value,
    filters: Object.keys(finalFilters).length > 0 ? JSON.stringify(finalFilters) : null,
    embed_template: Object.keys(finalTemplate).length > 0 ? JSON.stringify(finalTemplate) : null
  });

  saving.value = false;
  isOpen.value = false;
};
</script>
