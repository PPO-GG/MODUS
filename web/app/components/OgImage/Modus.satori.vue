<script setup lang="ts">
// Default 1200×630 social card. Satori only supports flexbox layout and a
// subset of CSS, so everything is inline-styled and every multi-child div
// is display:flex.
withDefaults(
  defineProps<{
    title?: string;
    description?: string;
    eyebrow?: string;
  }>(),
  {
    title: "Your Discord Server, Supercharged",
    description:
      "Music, moderation, anti-raid, AI, voice recordings, XP leaderboards and tickets — all from one web dashboard.",
    eyebrow: "",
  },
);
</script>

<template>
  <div
    style="
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 72px 80px;
      background-color: #030712;
      background-image: radial-gradient(circle at 85% 15%, rgba(13, 148, 136, 0.5), transparent 55%),
        radial-gradient(circle at 10% 100%, rgba(3, 105, 161, 0.5), transparent 50%);
      color: #f9fafb;
    "
  >
    <div style="display: flex; align-items: center">
      <img src="/modus2.svg" width="88" height="88" />
      <div
        style="display: flex; margin-left: 24px; font-size: 44px; font-weight: 700; letter-spacing: 4px"
      >
        MODUS
      </div>
    </div>

    <div
      style="display: flex; flex-direction: column; padding: 40px 48px; border-radius: 24px; border: 1px solid rgba(243, 244, 246, 0.2); background-color: rgba(229, 231, 235, 0.1)"
    >
      <div
        v-if="eyebrow"
        style="display: flex; font-size: 28px; color: #2dd4bf; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 3px"
      >
        {{ eyebrow }}
      </div>
      <div style="display: flex; font-size: 68px; font-weight: 700; line-height: 1.1; color: #38bdf8">
        {{ title }}
      </div>
      <div
        style="display: flex; font-size: 30px; color: #d1d5db; margin-top: 24px; line-height: 1.4; max-width: 960px"
      >
        {{ description }}
      </div>
    </div>

    <div style="display: flex; font-size: 26px; color: #9ca3af">
      modusbot.io
    </div>
  </div>
</template>
