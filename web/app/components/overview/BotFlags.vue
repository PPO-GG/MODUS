<template>
  <OverviewPanel
    title="Bot flagged" :loading="loading" :error="error"
    :empty="!!data && data.length === 0" empty-text="Nothing flagged in the last 24 hours." @retry="reload"
  >
    <template #meta>24h</template>
    <ul class="space-y-1.5 font-mono text-xs">
      <li v-for="log in data?.slice(0, 6)" :key="log.$id" class="flex gap-2 min-w-0">
        <span :class="log.level === 'error' ? 'text-red-300' : 'text-amber-300'" class="shrink-0 uppercase">{{ log.level === "error" ? "ERR" : "WARN" }}</span>
        <span class="text-gray-400 truncate">{{ log.message }}</span>
        <span class="ml-auto shrink-0 text-gray-500">{{ timeAgo(log.timestamp) }}</span>
      </li>
    </ul>
    <NuxtLink :to="`/dashboard/server/${guildId}/logs`" class="inline-block mt-3 text-[13px] text-sky-200 hover:text-primary-300">View server logs →</NuxtLink>
  </OverviewPanel>
</template>

<script setup lang="ts">
const props = defineProps<{ guildId: string }>();
const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { data, loading, error, reload } = useOverviewFetch<Array<{ $id: string; level: string; message: string; timestamp: string }>>(
  () => `/api/logs?guild_id=${encodeURIComponent(props.guildId)}&level=warn,error&since=${encodeURIComponent(since)}&limit=20`,
);
</script>
