<template>
  <main class="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
    <slot name="header" />
    <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
      <div :class="chrome.fullBleed ? 'h-full' : 'px-4 md:px-8 py-6'">
        <slot />
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
// Padding lives on an inner wrapper so it scrolls with the content. Server
// and admin pages wrap themselves in an `h-full overflow-y-auto` box; inside
// this unsized wrapper that box grows with its content instead of becoming
// a nested scroller clipped by the padding. Full-bleed pages (welcome
// editor, XP) get a full-height wrapper and no padding.
const { state: chrome } = usePageChrome();
</script>
