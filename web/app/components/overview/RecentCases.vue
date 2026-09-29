<template>
  <OverviewPanel
    title="Recent moderation" :loading="loading" :error="error"
    :empty="!!data && data.cases.length === 0" empty-text="No moderation actions yet." @retry="reload"
  >
    <template v-if="summary" #meta>7d: {{ summary }}</template>
    <ul class="divide-y divide-white/5">
      <li v-for="c in data?.cases" :key="c.caseNumber" class="flex items-center gap-3 py-2 text-sm min-w-0">
        <span class="pill" :class="`act-${c.action}`">{{ c.action }}</span>
        <span class="text-gray-200 truncate">{{ c.targetTag }}</span>
        <span v-if="c.durationMinutes" class="text-xs text-gray-500">{{ formatMinutes(c.durationMinutes) }}</span>
        <span v-if="c.reason" class="text-xs text-gray-400 truncate hidden sm:inline">“{{ c.reason }}”</span>
        <span class="ml-auto shrink-0 text-xs text-gray-500">
          {{ c.moderatorTag ?? "unknown" }} · {{ c.source === "discord" ? "Discord" : `/${c.action}` }} · {{ timeAgo(c.createdAt) }}
        </span>
      </li>
    </ul>
  </OverviewPanel>
</template>

<script setup lang="ts">
import { formatMinutes } from "~/utils/time-ago";
const props = defineProps<{ guildId: string }>();
const { data, loading, error, reload } = useOverviewFetch<{
  cases: Array<{ caseNumber: number; action: string; targetTag: string; moderatorTag: string | null; reason: string | null; durationMinutes: number | null; source: string; createdAt: string }>;
  counts7d: Record<string, number>;
}>(() => `/api/moderation/cases?guild_id=${encodeURIComponent(props.guildId)}&limit=8`);

const summary = computed(() => {
  const c = data.value?.counts7d;
  if (!c) return "";
  const parts: string[] = [];
  const add = (n: number | undefined, one: string, many: string) => { if (n) parts.push(`${n} ${n === 1 ? one : many}`); };
  add(c.ban, "ban", "bans");
  add(c.kick, "kick", "kicks");
  add(c.timeout, "timeout", "timeouts");
  add(c.warn, "warn", "warns");
  return parts.join(" · ") || "none";
});
</script>

<style scoped>
.pill { font: 500 10.5px/1 var(--glide-mono); padding: 4px 7px; border-radius: 999px; text-transform: uppercase; flex-shrink: 0; }
.act-ban { background: rgba(248, 113, 113, 0.12); color: #fca5a5; }
.act-kick { background: rgba(251, 146, 60, 0.12); color: #fdba74; }
.act-timeout { background: rgba(250, 204, 21, 0.12); color: #fde047; }
.act-warn, .act-purge { background: rgba(163, 163, 163, 0.12); color: #d4d4d4; }
.act-unban, .act-untimeout { background: rgba(52, 211, 153, 0.12); color: #6ee7b7; }
</style>
