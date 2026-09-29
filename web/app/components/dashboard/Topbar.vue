<template>
  <header
    class="flex items-center justify-between gap-4 h-16 shrink-0 px-4 md:px-6 border-b border-white/10 bg-[rgba(3,7,18,0.6)] backdrop-blur-xl"
  >
    <div class="flex items-center gap-3 min-w-0">
      <UButton
        v-if="showMenu"
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        class="md:hidden"
        :aria-label="menuOpen ? 'Close section menu' : 'Open section menu'"
        :aria-expanded="menuOpen"
        aria-controls="dashboard-context-sidebar"
        @click="emit('toggle-sidebar')"
      />
      <h1 class="text-lg font-medium text-white truncate">{{ title }}</h1>
    </div>

    <div class="flex items-center gap-3">
      <slot />
      <div
        v-if="isMounted"
        class="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-mono"
        :class="statusClass"
      >
        <span class="w-1.5 h-1.5 rounded-full" :class="dotClass" />
        {{ statusLabel }}
        <span v-if="botHealthOnline && botLatency > 0" class="text-gray-500">· {{ botLatency }} ms</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{ showMenu?: boolean; menuOpen?: boolean }>();
const emit = defineEmits<{ "toggle-sidebar": [] }>();

const { botHealthOnline, botLatency, healthChecking, lastHealthCheck } = useBotHealth();
const { state: ctx } = useServerSidebar();
const route = useRoute();
const isMounted = ref(false);
onMounted(() => (isMounted.value = true));

const title = computed(() => {
  if (ctx.value) {
    return ctx.value.tabs.find((t) => t.id === ctx.value!.activeTab)?.label ?? ctx.value.guild?.name ?? "Dashboard";
  }
  if (route.path.startsWith("/dashboard/discover")) return "Add a server";
  return "Home";
});

const checking = computed(() => healthChecking.value && !lastHealthCheck.value);
const statusLabel = computed(() =>
  botHealthOnline.value ? "LIVE" : checking.value ? "CHECKING" : "OFFLINE",
);
const statusClass = computed(() =>
  botHealthOnline.value
    ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-300"
    : checking.value
      ? "border-amber-400/30 bg-amber-400/5 text-amber-300"
      : "border-red-400/30 bg-red-400/5 text-red-300",
);
const dotClass = computed(() =>
  botHealthOnline.value
    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
    : checking.value
      ? "bg-amber-400"
      : "bg-red-400",
);
</script>
