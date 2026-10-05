<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-cpu"
      title="AI Assistant"
      description="@mention the bot to chat. Powered by the LLM provider you choose."
      :enabled="moduleEnabled"
    >
      <template #status>
        <div class="flex shrink-0 items-center gap-3">
          <span
            v-if="isPremium"
            class="hidden items-center gap-1 rounded-full bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-300 ring-1 ring-inset ring-amber-400/25 sm:inline-flex"
          >
            <UIcon name="i-lucide-star" class="h-3 w-3" />
            Premium
          </span>
          <label class="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <span class="hidden sm:inline">{{ moduleEnabled ? "Active" : "Disabled" }}</span>
            <USwitch
              v-model="moduleEnabled"
              :loading="savingEnabled"
              aria-label="Enable the AI module"
              @update:model-value="toggleModule"
            />
          </label>
        </div>
      </template>
    </DashboardModuleHeader>

    <!-- ── Key status ── -->
    <p
      v-if="!settings.aiApiKey && !isPremium"
      class="flex items-start gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2.5 text-[13px] text-amber-200"
    >
      <UIcon name="i-lucide-star" class="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong class="font-semibold">Hosted AI requires Premium.</strong>
        This server has no premium subscription and no API key. Add your own key below to use the
        AI module, or ask the bot owner to enable Premium for this server.
      </span>
    </p>
    <p
      v-else-if="!settings.aiApiKey && isPremium"
      class="flex items-start gap-2 rounded-lg bg-emerald-400/[0.08] px-3 py-2.5 text-[13px] text-emerald-300"
    >
      <UIcon name="i-lucide-circle-check" class="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        <strong class="font-semibold">Using Modus Hosted AI.</strong>
        This server is premium and uses the bot's shared key. Add your own key below to use a
        different provider or lift the rate limits.
      </span>
    </p>

    <!-- ── Provider & model ── -->
    <DashboardModuleSection
      title="Provider & model"
      description="Which LLM answers, and the key it uses."
    >
      <div class="space-y-5">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Provider" required class="w-full">
            <USelectMenu
              v-model="settings.aiProvider"
              :items="providerOptions"
              value-key="value"
              :search-input="false"
              placeholder="Select a provider…"
              icon="i-lucide-cpu"
              class="w-full"
              @update:model-value="(v) => onProviderChange(String(v ?? ''))"
            />
          </UFormField>

          <UFormField
            label="API key"
            hint="Optional with Premium"
            description="Leave empty to use the hosted key."
            class="w-full"
          >
            <UInput
              v-model="settings.aiApiKey"
              :type="showKey ? 'text' : 'password'"
              placeholder="sk-… or your provider's key"
              icon="i-lucide-key-round"
              autocomplete="off"
              class="w-full"
              :ui="{ trailing: 'pe-1' }"
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  :icon="showKey ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showKey ? 'Hide API key' : 'Show API key'"
                  @click="showKey = !showKey"
                />
              </template>
            </UInput>
          </UFormField>
        </div>

        <UFormField
          label="Model"
          :required="!!settings.aiApiKey"
          :description="settings.aiApiKey ? undefined : 'Hosted AI uses the model the bot owner picked. Add your own key to choose one.'"
          class="w-full"
        >
          <div class="flex gap-2">
            <USelectMenu
              v-model="settings.aiModel"
              :items="availableModels"
              :loading="modelsLoading"
              :disabled="modelsLoading || !settings.aiApiKey"
              :search-input="{ placeholder: 'Search models…' }"
              placeholder="Select a model…"
              icon="i-lucide-brain"
              class="min-w-0 flex-1"
            />
            <UButton
              icon="i-lucide-rotate-cw"
              color="neutral"
              variant="soft"
              :loading="modelsLoading"
              :disabled="!settings.aiApiKey"
              aria-label="Fetch available models"
              @click="fetchModels"
            />
          </div>
          <p v-if="modelsWarning" class="mt-2 text-[13px] text-amber-300">{{ modelsWarning }}</p>
        </UFormField>

        <UFormField
          v-if="settings.aiProvider === 'OpenAI Compatible'"
          label="Base URL"
          required
          hint="Ollama: http://localhost:11434/v1 · LM Studio: http://localhost:1234/v1"
          class="w-full"
        >
          <UInput
            v-model="settings.aiBaseUrl"
            placeholder="http://localhost:11434/v1"
            icon="i-lucide-globe"
            class="w-full"
          />
        </UFormField>

        <p class="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] pt-4 text-[13px] text-gray-400">
          <span>Get an API key:</span>
          <a
            v-for="link in providerLinks"
            :key="link.name"
            :href="link.url"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1 text-sky-200 underline underline-offset-2 hover:text-teal-300"
          >
            {{ link.name }}
            <UIcon name="i-lucide-external-link" class="h-3 w-3" />
          </a>
        </p>
      </div>
    </DashboardModuleSection>

    <!-- ── Personality ── -->
    <DashboardModuleSection
      title="Personality"
      description="Tone and extra instructions, added on top of Modus's built-in behaviour."
    >
      <template #actions>
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-rotate-cw" @click="resetSystemPrompt">
          Reset to default
        </UButton>
      </template>

      <div class="space-y-3">
        <UTextarea
          v-model="settings.systemPrompt"
          :rows="6"
          :maxlength="2000"
          placeholder="Describe the tone and any extra instructions…"
          class="w-full font-mono text-sm"
          :ui="{ base: 'font-mono text-sm' }"
          aria-label="System prompt"
        />
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span
            class="text-xs"
            :class="(settings.systemPrompt?.length ?? 0) > 1800 ? 'text-amber-300' : 'text-gray-400'"
          >
            {{ settings.systemPrompt?.length ?? 0 }} / 2000 characters
          </span>
          <span class="text-xs text-gray-400">Leave blank for the default friendly tone.</span>
        </div>

        <details class="group rounded-lg ring-1 ring-inset ring-white/10">
          <summary
            class="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm text-white select-none"
          >
            Built-in behaviour (always applied)
            <UIcon
              name="i-lucide-chevron-down"
              class="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180"
            />
          </summary>
          <p class="border-t border-white/[0.06] p-3 text-[13px] leading-relaxed text-gray-400">
            {{ CORE_BEHAVIOR_PREVIEW }}
          </p>
        </details>
      </div>
    </DashboardModuleSection>

    <!-- ── Features ── -->
    <DashboardModuleSection title="Features" description="What the assistant is allowed to do.">
      <div class="space-y-1">
        <label
          class="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-white">Respond in DMs</span>
            <span class="block text-[13px] text-gray-400">Answer @mentions in direct messages too.</span>
          </span>
          <USwitch v-model="settings.respondToDMs" aria-label="Respond in DMs" />
        </label>

        <label
          class="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-white">Tool use</span>
            <span class="block text-[13px] text-gray-400">
              Let the AI control music (play, skip, pause, queue), search the web and find images.
            </span>
          </span>
          <USwitch v-model="settings.toolUseEnabled" aria-label="Enable tool use" />
        </label>
      </div>

      <p
        v-if="settings.toolUseEnabled && toolUseWarning"
        class="mt-3 flex items-start gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
      >
        <UIcon name="i-lucide-triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong class="font-semibold">{{ toolUseWarning }}</strong>
          Tool use works best with 70B+ models. Try llama-3.3-70b-versatile (Groq, free) or
          gpt-4o-mini (OpenAI).
        </span>
      </p>
    </DashboardModuleSection>

    <!-- ── Conversation memory ── -->
    <DashboardModuleSection
      title="Conversation memory"
      description="Recent messages in a channel are included so follow-ups feel natural."
    >
      <div class="space-y-5">
        <label
          class="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-white">Remember context</span>
            <span class="block text-[13px] text-gray-400">Keep recent messages per channel.</span>
          </span>
          <USwitch v-model="settings.contextEnabled" aria-label="Remember conversation context" />
        </label>

        <template v-if="settings.contextEnabled">
          <div>
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <label class="text-sm font-medium text-white" for="ai-ctx-count">Messages to remember</label>
              <span class="text-sm text-sky-200">{{ settings.contextMessageCount }} messages</span>
            </div>
            <USlider id="ai-ctx-count" v-model="settings.contextMessageCount" :min="1" :max="20" :step="1" />
            <p class="mt-2 text-[13px] text-gray-400">More means better continuity but uses more tokens.</p>
          </div>

          <div>
            <div class="mb-2 flex items-baseline justify-between gap-3">
              <label class="text-sm font-medium text-white" for="ai-ctx-ttl">Memory duration</label>
              <span class="text-sm text-sky-200">{{ settings.contextTTLMinutes }} minutes</span>
            </div>
            <USlider id="ai-ctx-ttl" v-model="settings.contextTTLMinutes" :min="1" :max="60" :step="1" />
            <p class="mt-2 text-[13px] text-gray-400">Older messages are forgotten, which keeps conversations fresh.</p>
          </div>

          <p class="flex items-center gap-2 rounded-lg bg-sky-200/[0.06] px-3 py-2 text-[13px] text-sky-200">
            <UIcon name="i-lucide-info" class="h-4 w-4 shrink-0" />
            Context is trimmed to fit your max input tokens. The new message always gets priority.
          </p>
        </template>
      </div>
    </DashboardModuleSection>

    <!-- ── Limits ── -->
    <DashboardModuleSection
      title="Limits"
      description="Rate and length limits for each member's requests."
    >
      <div class="space-y-5">
        <p
          v-if="!settings.aiApiKey"
          class="flex items-center gap-2 rounded-lg bg-amber-400/[0.08] px-3 py-2 text-[13px] text-amber-200"
        >
          <UIcon name="i-lucide-triangle-alert" class="h-4 w-4 shrink-0" />
          Shared key limits: 60s cooldown, 500 input tokens and 300 output tokens at most. Add your
          own key to raise them.
        </p>

        <div>
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <label class="text-sm font-medium text-white" for="ai-cooldown">Member cooldown</label>
            <span class="text-sm text-sky-200">{{ settings.rateLimitSeconds }}s</span>
          </div>
          <USlider
            id="ai-cooldown"
            v-model="settings.rateLimitSeconds"
            :min="settings.aiApiKey ? 5 : 60"
            :max="300"
            :step="5"
          />
        </div>

        <div>
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <label class="text-sm font-medium text-white" for="ai-max-in">Max input tokens</label>
            <span class="text-sm text-sky-200">{{ settings.maxInputTokens }} tokens</span>
          </div>
          <USlider
            id="ai-max-in"
            v-model="settings.maxInputTokens"
            :min="100"
            :max="settings.aiApiKey ? 4000 : 500"
            :step="50"
          />
          <p class="mt-2 text-[13px] text-gray-400">Caps message length (about 4 characters per token).</p>
        </div>

        <div>
          <div class="mb-2 flex items-baseline justify-between gap-3">
            <label class="text-sm font-medium text-white" for="ai-max-out">Max output tokens</label>
            <span class="text-sm text-sky-200">{{ settings.maxOutputTokens }} tokens</span>
          </div>
          <USlider
            id="ai-max-out"
            v-model="settings.maxOutputTokens"
            :min="50"
            :max="settings.aiApiKey ? 4000 : 300"
            :step="50"
          />
          <p class="mt-2 text-[13px] text-gray-400">Controls response length. Longer answers cost more.</p>
        </div>
      </div>
    </DashboardModuleSection>

    <!-- ── Usage & spending ── -->
    <DashboardModuleSection title="Usage & spending" description="Recent AI calls for this server.">
      <template #actions>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-rotate-cw"
          :loading="usageLoading"
          aria-label="Refresh usage"
          @click="fetchUsage"
        />
      </template>

      <div v-if="usageLoading" class="space-y-2" aria-busy="true">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div v-for="i in 4" :key="i" class="h-16 animate-pulse rounded-lg bg-white/[0.04]" />
        </div>
      </div>

      <p v-else-if="usageLogs.length === 0" class="text-[13px] text-gray-400">
        No usage recorded yet. @mention the bot to get started.
      </p>

      <div v-else class="space-y-6">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div v-for="stat in usageStats" :key="stat.label" class="rounded-lg bg-white/[0.04] p-3">
            <p class="text-xs text-gray-400">{{ stat.label }}</p>
            <p class="mt-0.5 font-mono text-lg font-semibold text-white">{{ stat.value }}</p>
          </div>
        </div>

        <div>
          <div class="mb-1 flex justify-between text-xs text-gray-400">
            <span>Input tokens</span>
            <span>Output tokens</span>
          </div>
          <div class="flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div class="bg-sky-300 transition-all" :style="{ width: inputRatioPct + '%' }" />
            <div class="bg-teal-300 transition-all" :style="{ width: outputRatioPct + '%' }" />
          </div>
          <div class="mt-1 flex justify-between font-mono text-xs text-gray-400">
            <span>{{ totalInputTokens.toLocaleString() }}</span>
            <span>{{ totalOutputTokens.toLocaleString() }}</span>
          </div>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-medium text-white">By model</h3>
          <ul class="-mx-2 divide-y divide-white/[0.06]">
            <li
              v-for="entry in modelBreakdown"
              :key="entry.model"
              class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-2 py-2.5"
            >
              <span class="min-w-0">
                <span class="text-sm font-medium text-white">{{ entry.model }}</span>
                <span class="ml-2 text-xs text-gray-400">{{ entry.provider }}</span>
              </span>
              <span class="flex items-center gap-4 text-xs text-gray-400">
                <span>{{ entry.calls }} call{{ entry.calls !== 1 ? "s" : "" }}</span>
                <span>{{ entry.tokens.toLocaleString() }} tokens</span>
                <span class="font-mono text-teal-300">${{ entry.cost.toFixed(4) }}</span>
              </span>
            </li>
          </ul>
        </div>

        <div>
          <h3 class="mb-2 text-sm font-medium text-white">Recent activity</h3>
          <div class="-mx-2 max-h-80 overflow-auto px-2">
            <table class="w-full text-xs">
              <thead class="sticky top-0 bg-[#060a14]">
                <tr class="border-b border-white/10 text-gray-400">
                  <th class="pb-2 text-left font-medium">Time</th>
                  <th class="pb-2 text-left font-medium">User</th>
                  <th class="pb-2 text-left font-medium">Model</th>
                  <th class="pb-2 text-right font-medium">Tokens</th>
                  <th class="pb-2 text-right font-medium">Cost</th>
                  <th class="pb-2 text-center font-medium">Type</th>
                  <th class="pb-2 text-center font-medium">Key</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-white/[0.06]">
                <tr v-for="log in usageLogs.slice(0, 20)" :key="log.$id">
                  <td class="whitespace-nowrap py-2 text-gray-400">{{ formatTime(log.timestamp) }}</td>
                  <td class="max-w-24 truncate py-2 font-mono text-gray-300">{{ log.userId }}</td>
                  <td class="py-2 text-gray-200">{{ log.model }}</td>
                  <td class="py-2 text-right text-gray-300">{{ (log.total_tokens || 0).toLocaleString() }}</td>
                  <td class="py-2 text-right font-mono text-teal-300">
                    ${{ (log.estimated_cost || 0).toFixed(4) }}
                  </td>
                  <td class="py-2 text-center">
                    <span
                      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                      :class="
                        log.action === 'tool_use'
                          ? 'bg-teal-300/10 text-teal-300'
                          : 'bg-sky-200/10 text-sky-200'
                      "
                    >
                      <UIcon
                        :name="log.action === 'tool_use' ? 'i-lucide-wrench' : 'i-lucide-message-square'"
                        class="h-3 w-3"
                      />
                      {{ log.action === "tool_use" ? "Tool" : "Chat" }}
                    </span>
                  </td>
                  <td class="py-2 text-center">
                    <span
                      class="rounded-full px-2 py-0.5"
                      :class="
                        log.key_source === 'guild'
                          ? 'bg-sky-200/10 text-sky-200'
                          : 'bg-amber-400/10 text-amber-300'
                      "
                    >
                      {{ log.key_source === "guild" ? "Guild" : "Shared" }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardModuleSection>

    <DashboardModuleAccessSection :guild-id="guildId" module-name="ai" />

    <DashboardModuleSaveBar :dirty="dirty" :saving="saving" @save="saveSettings" @discard="discard" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";

const route = useRoute();
const toast = useToast();

const guildId = computed(() => route.params.guild_id as string);

// ── State ──────────────────────────────────────────────────────────

const moduleEnabled = ref(false);
const savingEnabled = ref(false);
const saving = ref(false);
const isPremium = ref(false);
const showKey = ref(false);

const DEFAULT_PERSONALITY = `You have a witty, upbeat personality and keep a conversational, friendly tone.`;

// Full default prompts shipped before the append-model change. If a guild has one
// stored verbatim, show the tone default instead of the old wall of text.
const LEGACY_DEFAULT_PROMPTS = [
  `You are Modus, a helpful and friendly AI assistant built into a Discord bot. \nYou have a witty, upbeat personality. Keep responses concise (2-4 sentences max) and conversational. \nYou can help with questions, have casual conversations, and assist server members. \nDo not pretend to have capabilities you don't have. Stay on topic and be helpful.`,
];

// Read-only preview of the bot-owned rules the personality is appended to.
const CORE_BEHAVIOR_PREVIEW = `You are Modus, a helpful AI assistant built into a Discord bot. Always give a complete answer — include the specific facts, numbers, and details asked for. When tools are enabled, act instead of narrating (never say "let me look that up" — just do it, then answer). Never pretend to have capabilities you don't have.`;

function normalizeWhitespace(s: string | undefined | null) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

const settings = ref({
  aiProvider: "Groq" as string,
  aiApiKey: "",
  aiModel: "llama-3.3-70b-versatile",
  aiBaseUrl: "",
  systemPrompt: DEFAULT_PERSONALITY,
  maxInputTokens: 500,
  maxOutputTokens: 512,
  rateLimitSeconds: 60,
  respondToDMs: false,
  toolUseEnabled: false,
  contextEnabled: true,
  contextMessageCount: 5,
  contextTTLMinutes: 15,
});

// Last loaded/saved values (JSON); drives the unsaved-changes bar and Discard.
const baseline = ref(JSON.stringify(settings.value));
const dirty = computed(() => JSON.stringify(settings.value) !== baseline.value);

const availableModels = ref<string[]>([
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
]);
const modelsLoading = ref(false);
const modelsWarning = ref("");

const usageLogs = ref<any[]>([]);
const usageLoading = ref(false);

// ── Consts ─────────────────────────────────────────────────────────

const providerOptions = [
  { label: "Groq (Free · Recommended)", value: "Groq" },
  { label: "OpenAI", value: "OpenAI" },
  { label: "Google Gemini", value: "Google Gemini" },
  { label: "Anthropic Claude", value: "Anthropic Claude" },
  {
    label: "OpenAI Compatible (Ollama, LM Studio…)",
    value: "OpenAI Compatible",
  },
];

const providerLinks = [
  { name: "Groq", url: "https://console.groq.com" },
  { name: "OpenAI", url: "https://platform.openai.com/api-keys" },
  { name: "Google Gemini", url: "https://aistudio.google.com/apikey" },
  { name: "Anthropic", url: "https://console.anthropic.com" },
];

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  Groq: "llama-3.3-70b-versatile",
  OpenAI: "gpt-4o-mini",
  "Google Gemini": "gemini-2.0-flash",
  "Anthropic Claude": "claude-haiku-3-5",
  "OpenAI Compatible": "",
};

// ── Usage Computed ─────────────────────────────────────────────────

const totalCalls = computed(() => usageLogs.value.length);
const totalInputTokens = computed(() =>
  usageLogs.value.reduce((s, l) => s + (l.input_tokens || 0), 0),
);
const totalOutputTokens = computed(() =>
  usageLogs.value.reduce((s, l) => s + (l.output_tokens || 0), 0),
);
const totalTokens = computed(
  () => totalInputTokens.value + totalOutputTokens.value,
);
const totalCost = computed(() =>
  usageLogs.value.reduce((s, l) => s + (l.estimated_cost || 0), 0),
);

const inputRatioPct = computed(() => {
  const total = totalTokens.value;
  return total === 0 ? 50 : (totalInputTokens.value / total) * 100;
});
const outputRatioPct = computed(() => 100 - inputRatioPct.value);

const usageStats = computed(() => [
  { label: "Total calls", value: totalCalls.value.toLocaleString() },
  { label: "Total tokens", value: totalTokens.value.toLocaleString() },
  { label: "Total cost", value: `$${totalCost.value.toFixed(4)}` },
  {
    label: "Avg cost per call",
    value:
      totalCalls.value === 0
        ? "$0.0000"
        : `$${(totalCost.value / totalCalls.value).toFixed(4)}`,
  },
]);

// Warn if tool use is enabled with a small/low-capability model
const SMALL_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.2-1b",
  "llama-3.2-3b",
  "gemma-7b",
  "gemma2-9b",
];
const toolUseWarning = computed(() => {
  if (!settings.value.toolUseEnabled) return "";
  const model = settings.value.aiModel?.toLowerCase() ?? "";
  const isSmall = SMALL_MODELS.some((m) => model.includes(m.toLowerCase()));
  if (isSmall) {
    return `"${settings.value.aiModel}" may produce unreliable tool calls.`;
  }
  return "";
});

const modelBreakdown = computed(() => {
  const map = new Map<
    string,
    { provider: string; calls: number; tokens: number; cost: number }
  >();
  for (const log of usageLogs.value) {
    const key = log.model;
    if (!map.has(key)) {
      map.set(key, { provider: log.provider, calls: 0, tokens: 0, cost: 0 });
    }
    const entry = map.get(key)!;
    entry.calls++;
    entry.tokens += log.total_tokens || 0;
    entry.cost += log.estimated_cost || 0;
  }
  return [...map.entries()]
    .map(([model, data]) => ({ model, ...data }))
    .sort((a, b) => b.calls - a.calls);
});

// ── Methods ────────────────────────────────────────────────────────

// Watchers only react to the user's edits, not to the initial load (which
// fetches the model list itself).
let watching = false;

async function loadSettings() {
  try {
    // Load module enabled state + settings via the guild-configs endpoint.
    const cfg = await $fetch<{
      enabled: boolean;
      settings: Record<string, any>;
    }>(
      `/api/guild-configs/${encodeURIComponent(
        guildId.value,
      )}/${encodeURIComponent("ai")}`,
    );
    moduleEnabled.value = cfg.enabled;
    settings.value = { ...settings.value, ...(cfg.settings ?? {}) };

    // Legacy full prompt or empty → show the tone default (append-model migration).
    const norm = normalizeWhitespace(settings.value.systemPrompt);
    const isLegacy = LEGACY_DEFAULT_PROMPTS.some(
      (p) => normalizeWhitespace(p) === norm,
    );
    if (!norm || isLegacy) settings.value.systemPrompt = DEFAULT_PERSONALITY;

    // Taken before the model fetch, so an implicit model swap shows as unsaved.
    baseline.value = JSON.stringify(settings.value);

    // Premium flag lives on the servers row. by-guild-ids returns just
    // the public projection we need without paginating the whole list.
    try {
      const rows = await $fetch<any[]>(
        `/api/servers/by-guild-ids?ids=${encodeURIComponent(guildId.value)}`,
      );
      if (rows.length > 0) {
        // admin_user_ids is returned but we only need `premium` here —
        // fetch a detailed-server endpoint later if more fields are needed.
        isPremium.value = (rows[0] as any).premium === true;
      }
    } catch {
      // non-fatal — premium-only UI gracefully falls back to standard
    }

    await fetchModels();
    await fetchUsage();
  } catch (err) {
    console.error("[AI Dashboard] Error loading settings:", err);
  } finally {
    watching = true;
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    await $fetch(
      `/api/guild-configs/${encodeURIComponent(
        guildId.value,
      )}/${encodeURIComponent("ai")}`,
      {
        method: "PUT",
        body: { settings: settings.value },
      },
    );

    baseline.value = JSON.stringify(settings.value);
    toast.add({
      title: "Saved",
      description: "AI settings updated.",
      color: "success",
    });
  } catch (err) {
    console.error("[AI Dashboard] Save error:", err);
    toast.add({
      title: "Error",
      description: "Failed to save settings.",
      color: "error",
    });
  } finally {
    saving.value = false;
  }
}

function discard() {
  settings.value = JSON.parse(baseline.value);
}

async function toggleModule(enabled: boolean) {
  savingEnabled.value = true;
  try {
    await $fetch(
      `/api/guild-configs/${encodeURIComponent(
        guildId.value,
      )}/${encodeURIComponent("ai")}`,
      { method: "PUT", body: { enabled } },
    );
    toast.add({
      title: enabled ? "Module Enabled" : "Module Disabled",
      color: enabled ? "success" : "neutral",
    });
  } catch (err) {
    moduleEnabled.value = !enabled;
    toast.add({
      title: "Error",
      description: "Failed to update module status.",
      color: "error",
    });
  } finally {
    savingEnabled.value = false;
  }
}

async function fetchModels() {
  modelsWarning.value = "";
  // Without a guild key the bot uses the admin's provider/model, so the
  // guild's model choice is moot — don't probe the provider with no key.
  if (!settings.value.aiApiKey) return;
  modelsLoading.value = true;

  const provider = settings.value.aiProvider;
  const apiKey = settings.value.aiApiKey;

  try {
    const res = await $fetch<{ models: string[]; warning?: string }>(
      "/api/ai/models",
      {
        method: "POST",
        body: {
          provider,
          apiKey,
          baseUrl: settings.value.aiBaseUrl || undefined,
        },
      },
    );

    availableModels.value = res.models;
    if (res.warning) modelsWarning.value = res.warning;

    // If current model not in list, pick the first available
    if (
      availableModels.value.length > 0 &&
      !availableModels.value.includes(settings.value.aiModel)
    ) {
      settings.value.aiModel = availableModels.value[0] ?? "";
    }
  } catch (err) {
    console.error("[AI Dashboard] Failed to fetch models:", err);
    modelsWarning.value = "Could not fetch models. Check your API key.";
  } finally {
    modelsLoading.value = false;
  }
}

async function fetchUsage() {
  usageLoading.value = true;
  try {
    const response = await $fetch<{ documents: any[]; total: number }>(
      "/api/ai/usage",
      { query: { guild_id: guildId.value } },
    );
    usageLogs.value = response.documents;
  } catch (err) {
    console.error("[AI Dashboard] Error fetching usage:", err);
  } finally {
    usageLoading.value = false;
  }
}

// Picking a provider sets a sensible default model; the provider watcher below
// then fetches that provider's model list once.
function onProviderChange(provider: string) {
  settings.value.aiModel = PROVIDER_DEFAULT_MODELS[provider] || "";
}

// One fetch per provider change (the fallback list comes back even without a key).
watch(
  () => settings.value.aiProvider,
  () => {
    if (watching) fetchModels();
  },
);

// Fetch when a plausible API key has been typed, once typing pauses.
let keyTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => settings.value.aiApiKey,
  (key) => {
    clearTimeout(keyTimer);
    if (!watching || !key || key.length <= 10) return;
    keyTimer = setTimeout(fetchModels, 600);
  },
);
onBeforeUnmount(() => clearTimeout(keyTimer));

function resetSystemPrompt() {
  settings.value.systemPrompt = DEFAULT_PERSONALITY;
}

function formatTime(ts: string) {
  if (!ts) return "";
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

onMounted(loadSettings);
</script>
