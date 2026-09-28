<template>
  <main class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
    <slot name="header" />
    <div
      class="flex-1 min-h-0 overflow-y-auto custom-scrollbar"
      :class="chrome.fullBleed ? '' : 'px-4 md:px-8 py-6'"
    >
      <slot />
    </div>
  </main>
</template>

<script setup lang="ts">
// Full-bleed pages (welcome editor, XP) opt out of the content padding.
const { state: chrome } = usePageChrome();
</script>
