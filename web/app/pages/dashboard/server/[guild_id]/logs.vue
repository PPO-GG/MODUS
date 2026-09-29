<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <DashboardModuleHeader
      :guild-id="guildId"
      icon="i-lucide-scroll-text"
      title="Server Logs"
      description="Recent bot activity and moderation events for this server."
    >
      <template #status>
        <div class="flex shrink-0 items-center gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-refresh-cw"
            :loading="refreshing"
            aria-label="Refresh logs"
            @click="fetchLogs"
          />
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-trash-2"
            :disabled="logs.length === 0"
            aria-label="Clear server logs"
            class="hover:!bg-red-500/10 hover:!text-red-300"
            @click="confirmModalOpen = true"
          />
        </div>
      </template>
    </DashboardModuleHeader>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <div
        class="inline-flex max-w-full overflow-x-auto rounded-full bg-white/[0.04] p-1 ring-1 ring-inset ring-white/10"
        role="group"
        aria-label="Filter by level"
      >
        <button
          v-for="lvl in logLevels"
          :key="lvl.value"
          type="button"
          :aria-pressed="levelFilter === lvl.value"
          class="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-teal-300"
          :class="
            levelFilter === lvl.value
              ? 'bg-sky-200/15 text-white ring-1 ring-inset ring-sky-100/25'
              : 'text-gray-400 hover:text-white'
          "
          @click="levelFilter = lvl.value"
        >
          {{ lvl.label }}
          <span
            v-if="getLevelCount(lvl.value) > 0"
            class="rounded-full px-1.5 text-[11px]"
            :class="lvl.badge"
          >
            {{ getLevelCount(lvl.value) }}
          </span>
        </button>
      </div>

      <UInput
        v-model="searchQuery"
        placeholder="Search logs…"
        icon="i-lucide-search"
        class="w-full sm:w-64"
        aria-label="Search logs"
      />

      <span class="ml-auto font-mono text-xs text-gray-400" aria-live="polite">
        {{ filteredLogs.length }} / {{ logs.length }} entries
      </span>
    </div>

    <!-- Log stream -->
    <section
      class="flex h-[65vh] min-h-[24rem] flex-col rounded-xl bg-[rgba(3,7,18,0.55)] p-3 font-mono text-xs ring-1 ring-inset ring-white/10"
      aria-label="Server log entries"
    >
      <div v-if="loading" class="space-y-2 p-2" aria-busy="true">
        <div v-for="i in 8" :key="i" class="h-5 animate-pulse rounded bg-white/[0.04]" />
      </div>

      <div
        v-else-if="logs.length === 0"
        class="flex flex-1 flex-col items-center justify-center gap-2 text-center font-sans"
      >
        <UIcon name="i-lucide-inbox" class="h-8 w-8 text-gray-600" />
        <p class="text-sm text-gray-300">No logs recorded yet</p>
        <p class="text-[13px] text-gray-400">Bot activity for this server will show up here.</p>
      </div>

      <div
        v-else-if="filteredLogs.length === 0"
        class="flex flex-1 flex-col items-center justify-center gap-2 text-center font-sans"
      >
        <UIcon name="i-lucide-search" class="h-8 w-8 text-gray-600" />
        <p class="text-sm text-gray-300">No logs match your filters</p>
        <UButton
          color="neutral"
          variant="soft"
          size="xs"
          @click="clearFilters"
        >
          Clear filters
        </UButton>
      </div>

      <div v-else class="flex-1 space-y-px overflow-y-auto pr-1" role="log">
        <div
          v-for="log in filteredLogs"
          :key="log.$id"
          class="flex flex-wrap gap-x-3 rounded px-2 py-1 transition-colors hover:bg-white/[0.04]"
        >
          <span class="shrink-0 whitespace-nowrap text-gray-500">{{ formatTime(log.timestamp) }}</span>
          <span
            class="min-w-[3.25rem] shrink-0 font-bold uppercase"
            :class="
              log.level === 'error'
                ? 'text-red-300'
                : log.level === 'warn'
                  ? 'text-amber-300'
                  : 'text-sky-300'
            "
          >
            {{ log.level }}
          </span>
          <span
            v-if="log.shardId !== undefined && log.shardId !== null"
            class="shrink-0 text-gray-500"
          >
            S{{ log.shardId }}
          </span>
          <span v-if="log.source" class="shrink-0 text-teal-300/80">{{ log.source }}</span>
          <!-- On narrow screens the message wraps onto its own line under the metadata. -->
          <span class="min-w-0 basis-full break-words text-gray-200 sm:flex-1 sm:basis-0">{{ log.message }}</span>
        </div>
      </div>
    </section>

    <!-- Clear confirmation -->
    <UModal
      v-model:open="confirmModalOpen"
      title="Clear server logs"
      description="Delete all logs for this server? This can't be undone."
    >
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton color="neutral" variant="ghost" :disabled="deleting" @click="confirmModalOpen = false">
            Cancel
          </UButton>
          <UButton color="error" :loading="deleting" @click="deleteLogs">Clear logs</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";

const route = useRoute();
const toast = useToast();
const guildId = route.params.guild_id as string;

const loading = ref(true);
const refreshing = ref(false);
const deleting = ref(false);
const confirmModalOpen = ref(false);
const logs = ref<any[]>([]);

const searchQuery = ref("");
const levelFilter = ref("all");

const logLevels = [
  { value: "all", label: "All", badge: "bg-white/[0.08] text-gray-300" },
  { value: "info", label: "Info", badge: "bg-sky-400/15 text-sky-200" },
  { value: "warn", label: "Warn", badge: "bg-amber-400/15 text-amber-200" },
  { value: "error", label: "Error", badge: "bg-red-400/15 text-red-200" },
];

const filteredLogs = computed(() => {
  let result = logs.value;
  if (levelFilter.value !== "all") {
    result = result.filter((l) => l.level === levelFilter.value);
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(
      (l) => l.message?.toLowerCase().includes(q) || l.source?.toLowerCase().includes(q),
    );
  }
  return result;
});

const getLevelCount = (level: string) => {
  if (level === "all") return logs.value.length;
  return logs.value.filter((l) => l.level === level).length;
};

const clearFilters = () => {
  levelFilter.value = "all";
  searchQuery.value = "";
};

const fetchLogs = async () => {
  refreshing.value = true;
  try {
    logs.value = await $fetch<any[]>(`/api/logs?guild_id=${encodeURIComponent(guildId)}&limit=500`);
  } catch (error) {
    console.error("Error fetching logs:", error);
  } finally {
    loading.value = false;
    refreshing.value = false;
  }
};

const deleteLogs = async () => {
  deleting.value = true;
  try {
    await $fetch(`/api/logs?guild_id=${encodeURIComponent(guildId)}`, {
      method: "DELETE",
    });
    logs.value = [];
    confirmModalOpen.value = false;
    toast.add({
      title: "Logs Cleared",
      description: "All server logs have been deleted.",
      color: "success",
    });
  } catch (error) {
    console.error("Error clearing logs:", error);
    toast.add({
      title: "Error",
      description: "Failed to clear server logs.",
      color: "error",
    });
  } finally {
    deleting.value = false;
  }
};

const formatTime = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

onMounted(() => {
  fetchLogs();
});
</script>
