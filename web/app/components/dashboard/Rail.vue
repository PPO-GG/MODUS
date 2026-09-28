<template>
  <nav
    class="dashboard-rail flex flex-col items-center gap-2 w-16 shrink-0 h-full py-3 bg-black/35 border-r border-white/10"
    aria-label="Servers"
  >
    <UTooltip text="Home" :content="{ side: 'right' }">
      <NuxtLink
        to="/dashboard"
        class="rail-item"
        :class="{ 'is-active': route.path === '/dashboard' }"
        aria-label="Home"
      >
        <img src="/modus2-animated.svg" alt="" class="w-9 h-9" />
      </NuxtLink>
    </UTooltip>

    <div class="w-6 h-px bg-white/10 my-1" />

    <div class="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-2 py-1 custom-scrollbar">
      <UTooltip
        v-for="server in servers"
        :key="server.$id"
        :text="server.name"
        :content="{ side: 'right' }"
      >
        <NuxtLink
          :to="`/dashboard/server/${server.$id}/modules`"
          class="rail-item"
          :class="{ 'is-active': isServerActive(server.$id) }"
          :aria-label="server.name"
        >
          <img
            v-if="server.icon"
            :src="guildIconUrl(server.$id, server.icon, 64) || undefined"
            alt=""
            class="w-full h-full object-cover"
          />
          <span v-else class="text-xs font-semibold text-white/80">{{
            guildInitials(server.name)
          }}</span>
        </NuxtLink>
      </UTooltip>

      <UTooltip text="Add a server" :content="{ side: 'right' }">
        <NuxtLink
          to="/dashboard/discover"
          class="rail-item rail-add"
          :class="{ 'is-active': route.path.startsWith('/dashboard/discover') }"
          aria-label="Add a server"
        >
          <UIcon name="i-lucide-plus" class="w-5 h-5" />
        </NuxtLink>
      </UTooltip>
    </div>

    <UTooltip v-if="userStore.isAdmin" text="Bot admin" :content="{ side: 'right' }">
      <NuxtLink
        to="/dashboard/admin"
        class="rail-item"
        :class="{ 'is-active': route.path.startsWith('/dashboard/admin') }"
        aria-label="Bot admin"
      >
        <UIcon name="i-lucide-shield-check" class="w-5 h-5" />
      </NuxtLink>
    </UTooltip>

    <UDropdownMenu
      :items="userMenu"
      :content="{ side: 'right', align: 'end' }"
    >
      <button type="button" class="rail-item" :aria-label="`Account: ${userStore.userName}`">
        <img
          v-if="userStore.userAvatar"
          :src="userStore.userAvatar"
          alt=""
          class="w-full h-full object-cover"
        />
        <span v-else class="text-xs font-semibold text-white/80">{{
          guildInitials(userStore.userName)
        }}</span>
      </button>
    </UDropdownMenu>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute();
const userStore = useUserStore();
const { servers, refresh } = useMyServers();

watch(
  () => userStore.initialized,
  async (ready) => {
    if (ready && userStore.isLoggedIn) await refresh();
  },
  { immediate: true },
);

function isServerActive(id: string) {
  return route.path.startsWith(`/dashboard/server/${id}`);
}

const userMenu = computed(() => [
  [{ label: userStore.userName, type: "label" as const }],
  [
    {
      label: "Log out",
      icon: "i-lucide-log-out",
      color: "error" as const,
      onSelect: () => userStore.logout(),
    },
  ],
]);
</script>

<style scoped>
.rail-item {
  display: grid;
  place-items: center;
  width: 2.625rem;
  height: 2.625rem;
  overflow: hidden;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--glide-ink-3);
  transition:
    border-radius 0.2s ease,
    box-shadow 0.2s ease,
    color 0.2s ease;
}
.rail-item:hover {
  border-radius: 0.75rem;
  color: var(--glide-ink);
}
.rail-item.is-active {
  border-radius: 0.75rem;
  color: var(--glide-ink);
  box-shadow:
    0 0 0 2px var(--glide-bg),
    0 0 0 3.5px var(--glide-a1);
}
.rail-item:focus-visible {
  outline: 2px solid var(--glide-a1);
  outline-offset: 2px;
}
.rail-add {
  background: transparent;
  border: 1px dashed var(--glide-ink-4);
  color: var(--glide-a1);
}
@media (prefers-reduced-motion: reduce) {
  .rail-item {
    transition: none;
  }
}
</style>
