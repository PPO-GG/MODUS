<template>
  <DashboardGroup>
    <DashboardRail />

    <div
      v-if="drawerOpen"
      class="fixed inset-0 z-30 bg-black/60 md:hidden"
      @click="drawerOpen = false"
    />
    <DashboardContextSidebar :open="drawerOpen" @close="drawerOpen = false" />

    <DashboardPanel>
      <template #header>
        <DashboardTopbar
          :show-menu="hasContext"
          :menu-open="drawerOpen"
          @toggle-sidebar="drawerOpen = !drawerOpen"
        />
      </template>
      <slot />
    </DashboardPanel>
  </DashboardGroup>
</template>

<script setup lang="ts">
const route = useRoute();
const { state: sidebarCtx } = useServerSidebar();
const hasContext = computed(() => !!sidebarCtx.value);

// Mobile drawer for the context sidebar; closes on every navigation.
const drawerOpen = ref(false);
watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false;
  },
);

// Escape closes the mobile drawer.
function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") drawerOpen.value = false;
}
watch(drawerOpen, (open) => {
  if (open) window.addEventListener("keydown", onKeydown);
  else window.removeEventListener("keydown", onKeydown);
});
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>

<style>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.12);
}
</style>
