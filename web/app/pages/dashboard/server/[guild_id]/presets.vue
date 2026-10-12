<!-- The Permission Presets page became Channel Access. Old links land here. -->
<template>
  <div />
</template>

<script setup lang="ts">
definePageMeta({
  middleware: [
    (to) => navigateTo(`/dashboard/server/${String(to.params.guild_id)}/access`, { replace: true }),
  ],
});
</script>
