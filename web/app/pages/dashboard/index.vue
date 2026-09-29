<template>
  <div class="max-w-6xl mx-auto">
    <!-- Heading -->
    <div class="flex flex-wrap items-end justify-between gap-6 mb-10">
      <div>
        <p class="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-2">
          Welcome back
        </p>
        <h2 class="text-4xl md:text-5xl font-medium tracking-tight text-white">
          Your <em class="glide-text">servers</em>
        </h2>
      </div>
      <UButton to="/dashboard/discover" icon="i-lucide-plus" size="lg">
        Add a server
      </UButton>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-20">
      <UIcon name="i-lucide-loader-circle" class="w-10 h-10 text-primary-400 animate-spin" />
    </div>

    <template v-else>
      <!-- Bot status strip -->
      <div class="flex flex-wrap items-center gap-x-10 gap-y-3 py-5 mb-12 border-y border-white/10">
        <div class="flex items-center gap-2.5">
          <span
            class="w-2 h-2 rounded-full"
            :class="botOnline ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]' : 'bg-red-400'"
          />
          <span class="font-mono text-sm" :class="botOnline ? 'text-emerald-300' : 'text-red-300'">
            {{ botOnline ? "Bot online" : "Bot offline" }}
          </span>
        </div>
        <div class="stat"><b>{{ servers.length }}</b><small>Servers</small></div>
        <div class="stat">
          <b>{{ servers.filter((s) => isServerOnline(s)).length }}</b><small>Online</small>
        </div>
        <div class="stat">
          <b>{{ shardsOnlineCount }}/{{ totalExpectedShards }}</b><small>Shards</small>
        </div>
        <div v-if="botStatus" class="stat"><b>v{{ botStatus.version }}</b><small>Version</small></div>
      </div>

      <!-- Empty state -->
      <div v-if="servers.length === 0" class="glide-glass max-w-xl mx-auto text-center p-10 mt-6">
        <UIcon name="i-lucide-server" class="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <h3 class="text-2xl font-medium text-white mb-2">No servers yet</h3>
        <p class="text-gray-400 mb-6">
          Add MODUS to a Discord server you manage to start configuring it here.
        </p>
        <UButton to="/dashboard/discover" icon="i-lucide-globe" size="lg">
          Discover servers
        </UButton>
      </div>

      <!-- Server cards -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 px-2">
        <NuxtLink
          v-for="server in servers"
          :key="server.$id"
          :to="`/dashboard/server/${server.$id}`"
          class="server-card glide-glass group"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div class="relative shrink-0">
              <img
                v-if="server.icon"
                :src="guildIconUrl(server.$id, server.icon, 128) || undefined"
                alt=""
                class="w-12 h-12 rounded-xl object-cover"
              />
              <span
                v-else
                class="grid place-items-center w-12 h-12 rounded-xl bg-white/5 font-semibold text-white/80"
              >{{ guildInitials(server.name) }}</span>
              <span
                class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#030712]"
                :class="isServerOnline(server) ? 'bg-emerald-400' : 'bg-red-400'"
              />
            </div>
            <div class="min-w-0">
              <h3 class="text-lg font-medium text-white truncate">{{ server.name }}</h3>
              <p class="font-mono text-[11px] text-gray-500 truncate">{{ server.$id }}</p>
            </div>
          </div>
          <div class="flex items-center justify-between mt-5 pt-4 border-t border-white/[0.06] text-sm">
            <span :class="isServerOnline(server) ? 'text-emerald-300' : 'text-red-300'">
              {{ isServerOnline(server) ? "Healthy" : "Offline" }}
            </span>
            <span class="font-mono text-[11px] text-gray-500">
              <template v-if="server.shard_id !== undefined">S{{ server.shard_id }} · </template>{{ formatLastChecked(server.last_checked) }}
            </span>
          </div>
          <span class="mt-4 inline-flex items-center gap-1.5 text-sm text-sky-200 group-hover:text-primary-300 transition-colors">
            Manage server <UIcon name="i-lucide-arrow-right" class="w-4 h-4" />
          </span>
        </NuxtLink>
      </div>

      <div v-if="isBotAdmin" class="mt-12 text-center">
        <UButton to="/dashboard/admin" icon="i-lucide-shield-check" color="neutral" variant="ghost">
          Bot admin panel
        </UButton>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";

const userStore = useUserStore();

useHead({ title: "Dashboard" });

const botStatus = ref(null);
const loading = ref(true);

const isBotAdmin = computed(() => userStore.isAdmin);
const { servers, refresh: fetchServers } = useMyServers();

const allShards = ref([]);

const botOnline = computed(() => {
  return visibleShards.value.length > 0;
});

const shardsOnlineCount = computed(() => {
  return visibleShards.value.length;
});

const visibleShards = computed(() => {
  return sortedShards.value.filter((shard) => isShardOnline(shard));
});

const totalExpectedShards = computed(() => {
  if (visibleShards.value.length > 0) {
    return visibleShards.value[0].total_shards ?? sortedShards.value.length;
  }
  return sortedShards.value.length;
});

const sortedShards = computed(() => {
  const uniqueShards = new Map();
  [...allShards.value].forEach((shard) => {
    const sid = shard.shard_id ?? -1;
    const existing = uniqueShards.get(sid);
    if (!existing || new Date(shard.last_seen) > new Date(existing.last_seen)) {
      uniqueShards.set(sid, shard);
    }
  });

  return Array.from(uniqueShards.values()).sort(
    (a, b) => (a.shard_id ?? 0) - (b.shard_id ?? 0),
  );
});

const isShardOnline = (shard) => {
  if (!shard?.last_seen) return false;
  const lastSeen = new Date(shard.last_seen).getTime();
  const now = Date.now();
  return now - lastSeen < 120000;
};

const isServerOnline = (server) => {
  if (server.shard_id === undefined) return false;
  const shard = sortedShards.value.find((s) => s.shard_id === server.shard_id);

  if (!shard && totalExpectedShards.value === 1) {
    const shard0 = sortedShards.value.find((s) => s.shard_id === 0);
    return isShardOnline(shard0);
  }

  return isShardOnline(shard);
};

const fetchBotStatus = async () => {
  try {
    const shards = await $fetch("/api/bot-status");
    allShards.value = shards;
    if (shards.length > 0) {
      botStatus.value =
        shards.find((d) => d.bot_id?.includes("Shard 0")) ?? shards[0];
    }
  } catch (error) {
    console.error("Error fetching bot status:", error);
  }
};

let statusTimer = null;
onUnmounted(() => {
  if (statusTimer) clearInterval(statusTimer);
});

// Wait for store init, redirect if not logged in
watch(
  () => userStore.initialized,
  async (ready) => {
    if (!ready) return;
    if (!userStore.isLoggedIn) {
      navigateTo("/login");
      return;
    }
    try {
      await Promise.all([fetchServers(), fetchBotStatus()]);
      if (statusTimer) clearInterval(statusTimer);
      statusTimer = setInterval(fetchBotStatus, 30000);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

const formatLastChecked = (dateString) => {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
</script>

<style scoped>
.stat {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
.stat b {
  font: 500 1.375rem/1.1 var(--glide-mono);
  font-variant-numeric: tabular-nums;
  color: var(--glide-ink);
}
.stat small {
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--glide-ink-4);
}
.server-card {
  display: flex;
  flex-direction: column;
  padding: 1.25rem;
  border-radius: 0.5rem;
  background: rgba(3, 7, 18, 0.6);
  transition: transform 0.2s ease;
}
.server-card:hover {
  transform: translateY(-2px);
}
.server-card:focus-visible {
  outline: 2px solid var(--glide-a1);
  outline-offset: 12px;
}
@media (prefers-reduced-motion: reduce) {
  .server-card {
    transition: none;
  }
  .server-card:hover {
    transform: none;
  }
}
</style>
