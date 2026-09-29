<template>
  <OverviewPanel
    :title="`Open tickets${data ? ` · ${data.tickets.length}` : ''}`"
    :loading="loading" :error="error" :empty="!!data && data.tickets.length === 0"
    empty-text="No open tickets." @retry="reload"
  >
    <template #meta>oldest first</template>
    <ul class="divide-y divide-white/5">
      <li v-for="t in data?.tickets" :key="t.threadId" class="flex items-center gap-3 py-2 text-sm">
        <span class="font-mono text-gray-500">#{{ String(t.ticketNumber).padStart(4, "0") }}</span>
        <span class="text-gray-200 truncate">{{ t.ownerTag ?? t.ownerId }}</span>
        <span class="pill" :class="`pri-${t.priority}`">{{ t.priority }}</span>
        <span class="ml-auto shrink-0 text-xs text-gray-500">
          {{ t.claimedBy ? (t.claimedByTag ?? "claimed") : "unclaimed" }} · {{ timeAgo(t.openedAt) }}
        </span>
        <a :href="t.url" target="_blank" rel="noopener" class="shrink-0 text-sky-200 hover:text-primary-300" :aria-label="`Open ticket ${t.ticketNumber} in Discord`">
          <UIcon name="i-lucide-external-link" class="w-4 h-4" />
        </a>
      </li>
    </ul>
  </OverviewPanel>
</template>

<script setup lang="ts">
const props = defineProps<{ guildId: string }>();
const { data, loading, error, reload } = useOverviewFetch<{
  tickets: Array<{ threadId: string; ticketNumber: number; ownerId: string; ownerTag: string | null; priority: string; claimedBy: string | null; claimedByTag: string | null; openedAt: string; url: string }>;
}>(() => `/api/tickets/open?guild_id=${encodeURIComponent(props.guildId)}`);
</script>

<style scoped>
.pill { font: 500 10.5px/1 var(--glide-mono); padding: 4px 7px; border-radius: 999px; text-transform: uppercase; }
.pri-low { background: rgba(52, 211, 153, 0.12); color: #6ee7b7; }
.pri-normal { background: rgba(56, 189, 248, 0.12); color: #7dd3fc; }
.pri-high { background: rgba(251, 146, 60, 0.12); color: #fdba74; }
.pri-critical { background: rgba(248, 113, 113, 0.14); color: #fca5a5; }
</style>
