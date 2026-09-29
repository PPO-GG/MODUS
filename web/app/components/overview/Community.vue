<template>
  <OverviewPanel title="Community" :loading="loading" :error="error" @retry="reload">
    <div v-if="data" class="grid grid-cols-2 gap-3">
      <div class="stat"><b>{{ data.memberCount.toLocaleString() }}</b><small>Members</small></div>
      <div class="stat"><b>{{ compact(data.totalMessages) }}</b><small>Messages</small></div>
    </div>
    <ol v-if="data?.top3.length" class="flex gap-2 mt-4" aria-label="Top members">
      <li v-for="u in data.top3" :key="u.userId" class="flex-1 min-w-0 text-center">
        <img v-if="u.avatar" :src="u.avatar" alt="" class="w-8 h-8 rounded-full mx-auto mb-1 object-cover" />
        <span v-else class="grid place-items-center w-8 h-8 rounded-full mx-auto mb-1 bg-white/5 text-xs">{{ guildInitials(u.username) }}</span>
        <span class="block text-xs text-gray-300 truncate">{{ u.username ?? u.userId }}</span>
        <span class="block text-[11px] text-gray-500 font-mono">Lv {{ u.level }}</span>
      </li>
    </ol>
  </OverviewPanel>
</template>

<script setup lang="ts">
const props = defineProps<{ guildId: string }>();
const { data, loading, error, reload } = useOverviewFetch<{
  memberCount: number; trackedMembers: number; totalMessages: number;
  top3: Array<{ userId: string; username: string | null; avatar: string | null; level: number; xp: number }>;
}>(() => `/api/servers/${encodeURIComponent(props.guildId)}/summary`);

const compact = (n: number) => new Intl.NumberFormat(undefined, { notation: "compact" }).format(n);
</script>

<style scoped>
.stat { border-radius: 0.625rem; padding: 0.625rem 0.75rem; box-shadow: inset 0 0 0 1px rgba(243, 244, 246, 0.08); }
.stat b { display: block; font: 500 1.25rem/1.2 var(--glide-mono); font-variant-numeric: tabular-nums; color: var(--glide-ink); }
.stat small { font-size: 0.625rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--glide-ink-4); }
</style>
