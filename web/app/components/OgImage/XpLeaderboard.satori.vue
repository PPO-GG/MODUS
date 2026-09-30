<script setup lang="ts">
// Social card for a server's public XP leaderboard: server identity plus the
// top-3 podium. Avatars are omitted on purpose — Discord serves most of them
// as WebP/GIF, which Satori can't decode, and one failed fetch would blank
// the whole slot.
withDefaults(
  defineProps<{
    guildName?: string;
    iconUrl?: string;
    top?: { username: string; level: number }[];
  }>(),
  {
    guildName: "Discord Server",
    iconUrl: "",
    top: () => [],
  },
);

const medals = ["#facc15", "#d4d4d8", "#d97706"];
</script>

<template>
  <div
    style="
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 64px 80px;
      background-color: #030712;
      background-image: radial-gradient(circle at 85% 15%, rgba(13, 148, 136, 0.5), transparent 55%),
        radial-gradient(circle at 10% 100%, rgba(3, 105, 161, 0.5), transparent 50%);
      color: #ffffff;
    "
  >
    <div style="display: flex; align-items: center">
      <img
        v-if="iconUrl"
        :src="iconUrl"
        width="112"
        height="112"
        style="border-radius: 24px"
      />
      <div style="display: flex; flex-direction: column; margin-left: 32px">
        <div style="display: flex; font-size: 28px; color: #5eead4; letter-spacing: 3px; text-transform: uppercase">
          XP Leaderboard
        </div>
        <div style="display: flex; font-size: 60px; font-weight: 700; line-height: 1.1; max-width: 900px">
          {{ guildName }}
        </div>
      </div>
    </div>

    <div
      v-if="!top.length"
      style="display: flex; font-size: 36px; color: #9ca3af"
    >
      Levels, ranks and the most active members — powered by MODUS.
    </div>
    <div v-else style="display: flex; flex-direction: column">
      <div
        v-for="(member, i) in top.slice(0, 3)"
        :key="i"
        style="display: flex; align-items: center; margin-top: 16px; font-size: 36px"
      >
        <div
          :style="`display: flex; width: 56px; height: 56px; border-radius: 28px; align-items: center; justify-content: center; font-weight: 700; color: #030712; background-color: ${medals[i]}`"
        >
          {{ i + 1 }}
        </div>
        <div style="display: flex; margin-left: 24px; font-weight: 700">
          {{ member.username }}
        </div>
        <div style="display: flex; margin-left: 20px; color: #9ca3af">
          Level {{ member.level }}
        </div>
      </div>
    </div>

    <div style="display: flex; align-items: center; font-size: 26px; color: #6b7280">
      <img src="/modus2.svg" width="40" height="40" />
      <div style="display: flex; margin-left: 14px">MODUS · modus.ppo.gg</div>
    </div>
  </div>
</template>
