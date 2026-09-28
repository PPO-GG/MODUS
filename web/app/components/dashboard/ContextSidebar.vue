<template>
  <aside
    v-if="ctx"
    id="dashboard-context-sidebar"
    :inert="isNarrow && !open"
    class="context-sidebar flex flex-col w-56 shrink-0 h-full border-r border-white/10 bg-[rgba(3,7,18,0.85)] backdrop-blur-xl"
    :class="open ? 'is-open' : ''"
    aria-label="Section navigation"
  >
    <!-- Header: server or admin identity -->
    <div class="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-white/10">
      <template v-if="isAdmin">
        <span class="grid place-items-center w-8 h-8 rounded-lg bg-primary-500/15 text-primary-300">
          <UIcon name="i-lucide-shield-check" class="w-4 h-4" />
        </span>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-white truncate">Bot Admin</p>
          <p class="text-[10px] uppercase tracking-widest text-gray-500">Admin panel</p>
        </div>
      </template>
      <template v-else>
        <img
          v-if="ctx.guild?.icon"
          :src="guildIconUrl(ctx.guild.id, ctx.guild.icon, 64) || undefined"
          alt=""
          class="w-8 h-8 rounded-lg object-cover"
        />
        <span
          v-else
          class="grid place-items-center w-8 h-8 rounded-lg bg-white/5 text-xs font-semibold text-white/80"
        >{{ guildInitials(ctx.guild?.name) }}</span>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-white truncate">{{ ctx.guild?.name }}</p>
          <p class="text-[10px] uppercase tracking-widest text-gray-500">Server settings</p>
        </div>
      </template>
    </div>

    <!-- Nav. A future "Overview" entry goes first here (reserved; not rendered). -->
    <nav class="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-2 py-3">
      <template v-for="tab in ctx.tabs" :key="tab.id">
        <p
          v-if="tab.groupLabel"
          class="px-3 pt-4 pb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-gray-500"
        >
          {{ tab.groupLabel }}
        </p>
        <div v-else-if="tab.separator" class="my-2 mx-3 border-t border-white/5" />

        <NuxtLink
          v-if="tab.to && !tab.disabled"
          :to="tab.to"
          class="nav-row"
          :class="{ 'is-active': ctx.activeTab === tab.id }"
          @click="emit('close')"
        >
          <UIcon
            :name="tab.icon"
            class="w-4 h-4 shrink-0"
            :class="ctx.activeTab === tab.id ? 'text-primary-400' : ''"
          />
          <span class="truncate">{{ tab.label }}</span>
          <UBadge v-if="tab.badge" variant="soft" color="neutral" size="xs" class="ml-auto">{{ tab.badge }}</UBadge>
        </NuxtLink>
        <button
          v-else
          type="button"
          class="nav-row w-full"
          :class="{ 'is-active': ctx.activeTab === tab.id, 'is-disabled': tab.disabled }"
          :disabled="tab.disabled"
          @click="tab.action?.(); emit('close')"
        >
          <UIcon :name="tab.icon" class="w-4 h-4 shrink-0" />
          <span class="truncate">{{ tab.label }}</span>
          <UBadge v-if="tab.badge" variant="soft" color="neutral" size="xs" class="ml-auto">{{ tab.badge }}</UBadge>
        </button>
      </template>
    </nav>
  </aside>
</template>

<script setup lang="ts">
defineProps<{ open?: boolean }>();
const emit = defineEmits<{ close: [] }>();

// Below md the sidebar is an off-canvas drawer; while closed it must not be
// focusable or announced. (Client-only: false during SSR/hydration.)
const isNarrow = ref(false);
let narrowMql: MediaQueryList | null = null;
const onNarrowChange = (e: MediaQueryListEvent) => (isNarrow.value = e.matches);
onMounted(() => {
  narrowMql = window.matchMedia("(max-width: 767px)");
  isNarrow.value = narrowMql.matches;
  narrowMql.addEventListener("change", onNarrowChange);
});
onUnmounted(() => narrowMql?.removeEventListener("change", onNarrowChange));

const { state: ctx } = useServerSidebar();
const isAdmin = computed(() => ctx.value?.guild?.id === "__admin__");
</script>

<style scoped>
.nav-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-block: 1px;
  padding: 0.5rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  color: var(--glide-ink-3);
  text-align: left;
  transition:
    background 0.15s ease,
    color 0.15s ease;
}
.nav-row:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--glide-ink);
}
.nav-row.is-active {
  background: rgba(56, 189, 248, 0.12);
  color: var(--glide-ink);
  box-shadow: inset 0 0 0 1px rgba(224, 242, 254, 0.18);
}
.nav-row.is-disabled {
  color: var(--glide-ink-4);
  cursor: not-allowed;
}
.nav-row:focus-visible {
  outline: 2px solid var(--glide-a1);
  outline-offset: 1px;
}

/* Below md the sidebar is an overlay drawer beside the rail. */
@media (max-width: 767px) {
  .context-sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 4rem;
    z-index: 40;
    transform: translateX(calc(-100% - 4rem));
    transition: transform 0.25s ease;
  }
  .context-sidebar.is-open {
    transform: translateX(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .nav-row,
  .context-sidebar {
    transition: none;
  }
}
</style>
