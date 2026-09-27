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
      background-color: #0a0a0f;
      background-image: radial-gradient(circle at 85% 15%, rgba(124, 58, 237, 0.45), transparent 55%),
        radial-gradient(circle at 10% 100%, rgba(99, 102, 241, 0.3), transparent 50%);
      color: #ffffff;
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

    <div style="display: flex; flex-direction: column">
      <div
        v-if="eyebrow"
        style="display: flex; font-size: 30px; color: #92d4dc; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 3px"
      >
        {{ eyebrow }}
      </div>
      <div style="display: flex; font-size: 68px; font-weight: 700; line-height: 1.1">
        {{ title }}
      </div>
      <div
        style="display: flex; font-size: 30px; color: #a1a1aa; margin-top: 24px; line-height: 1.4; max-width: 960px"
      >
        {{ description }}
      </div>
    </div>

    <div style="display: flex; font-size: 26px; color: #71717a">
      modus.ppo.gg
    </div>
  </div>
</template>
