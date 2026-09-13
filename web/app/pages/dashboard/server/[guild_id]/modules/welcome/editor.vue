<template>
  <!-- Full-bleed: no padding wrapper so the editor fills edge-to-edge -->
  <WelcomeEditor :guild-id="guildId" class="h-full" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";

const route = useRoute();
const guildId = route.params.guild_id as string;
const { setFullBleed, reset: resetPageChrome } = usePageChrome();

onMounted(() => {
  setFullBleed(true);
});

onUnmounted(() => {
  resetPageChrome();
});
</script>
