<template>
  <div />
</template>

<script setup lang="ts">
// The image editor is the Image tab on the Welcome page now; keep old links working.
const route = useRoute();
await navigateTo(
  { path: `/dashboard/server/${route.params.guild_id as string}/modules/welcome`, query: { tab: "image" } },
  { replace: true },
);
</script>
