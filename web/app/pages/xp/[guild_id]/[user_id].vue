<template>
  <div
    class="min-h-screen text-white pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto"
  >
    <!-- Breadcrumb & Back Navigation -->
    <div class="flex items-center justify-between gap-4 mb-8">
      <NuxtLink
        :to="`/xp/${guildId}`"
        class="glide-btn glide-btn-ghost !min-h-0 !px-3.5 !py-1.5 text-xs font-semibold group"
      >
        <UIcon
          name="i-heroicons-arrow-left"
          class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform"
        />
        Back to {{ data?.guild?.name || "Leaderboard" }}
      </NuxtLink>

      <div class="flex items-center gap-2">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-heroicons-link"
          @click="copyProfileLink"
        >
          {{ copied ? "Link Copied!" : "Share Profile" }}
        </UButton>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="pending" class="space-y-6">
      <div class="glide-tile h-64 rounded-3xl animate-pulse" />
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          v-for="i in 4"
          :key="i"
          class="glide-tile h-28 rounded-2xl animate-pulse"
        />
      </div>
    </div>

    <!-- Error State / Not Found -->
    <div
      v-else-if="error || !data?.user"
      class="glide-glass text-center py-20 px-6 max-w-lg mx-auto space-y-4"
    >
      <div
        class="w-16 h-16 mx-auto rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center"
      >
        <UIcon name="i-heroicons-user-minus" class="w-8 h-8 text-red-400" />
      </div>
      <h2 class="text-xl font-bold text-white">Member Profile Unavailable</h2>
      <p class="text-sm glide-ink-3">
        {{
          (error?.data as { statusMessage?: string } | undefined)?.statusMessage ||
          error?.statusMessage ||
          "This member has no recorded XP or has chosen to keep their profile private."
        }}
      </p>
      <NuxtLink :to="`/xp/${guildId}`" class="glide-btn mt-2">
        Return to Leaderboard
      </NuxtLink>
    </div>

    <!-- Main Profile Content -->
    <div v-else class="space-y-12">
      <!-- Profile Header Hero Banner -->
      <div class="glide-glass p-6 sm:p-10">
        <div
          class="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8 text-center md:text-left"
        >
          <!-- Avatar with Rank Border -->
          <div class="relative shrink-0">
            <div
              class="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl p-1.5 bg-[var(--glide-bg)] overflow-hidden transition-transform hover:scale-105"
              :class="avatarRingClass(data.user.rank)"
            >
              <img
                :src="getAvatarUrl(data.user.userId, data.user.avatar)"
                :alt="data.user.username"
                class="w-full h-full rounded-2xl object-cover"
              />
            </div>
            <!-- Rank Ribbon -->
            <div
              class="glide-podium-medal absolute -bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 whitespace-nowrap"
              :class="rankMetalClass(data.user.rank)"
            >
              <span v-if="data.user.rank === 1">👑 Rank #1</span>
              <span v-else-if="data.user.rank === 2">🥈 Rank #2</span>
              <span v-else-if="data.user.rank === 3">🥉 Rank #3</span>
              <span v-else>Rank #{{ data.user.rank }}</span>
            </div>
          </div>

          <!-- User Info & Level Hero -->
          <div class="flex-1 space-y-3 min-w-0">
            <div class="space-y-1">
              <div
                class="flex flex-wrap items-center justify-center md:justify-start gap-2.5"
              >
                <h1
                  class="text-2xl sm:text-4xl font-black text-white tracking-tight truncate"
                >
                  {{ data.user.username }}
                </h1>
                <span
                  class="glide-chip px-2.5 py-0.5 text-xs font-bold"
                >
                  Level {{ data.user.level }}
                </span>
              </div>
              <p
                class="text-xs sm:text-sm glide-ink-3 flex items-center justify-center md:justify-start gap-1.5"
              >
                <span class="w-2 h-2 rounded-full bg-emerald-500" />
                Active member in
                <strong class="glide-ink-2">{{ data.guild.name }}</strong>
              </p>
            </div>

            <!-- Next Level Progress Bar -->
            <div class="space-y-2 pt-2 max-w-xl">
              <div
                class="flex justify-between items-center text-xs font-semibold"
              >
                <span class="glide-ink-3">Level Progression</span>
                <span class="glide-a1 font-bold"
                  >{{ data.user.progressPercent }}% Complete</span
                >
              </div>
              <div class="glide-bar-track w-full h-3 p-0.5">
                <div
                  class="glide-bar-fill transition-all duration-700"
                  :style="{ width: `${data.user.progressPercent}%` }"
                />
              </div>
              <div class="flex justify-between text-[11px] glide-ink-4">
                <span
                  >{{ formatNumber(data.user.xpInCurrentLevel) }} XP
                  earned</span
                >
                <span
                  >{{ formatNumber(data.user.xpNeededForNextLevel) }} XP needed
                  for Level {{ data.user.level + 1 }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          v-for="stat in profileStats"
          :key="stat.label"
          class="glide-tile glide-tile-hover p-5 rounded-2xl space-y-1 text-center sm:text-left"
        >
          <div
            class="flex items-center justify-center sm:justify-between glide-ink-3 mb-2"
          >
            <span class="text-xs font-bold uppercase tracking-wider">{{
              stat.label
            }}</span>
            <UIcon
              :name="stat.icon"
              class="w-4 h-4 glide-a1 hidden sm:block"
            />
          </div>
          <p class="text-2xl sm:text-3xl font-black text-white">
            {{ stat.value }}
          </p>
          <p class="text-[11px] glide-ink-4 truncate">
            {{ stat.caption }}
          </p>
        </div>
      </div>

      <!-- Visual Discord Rank Card Preview -->
      <div class="glide-glass p-6 sm:p-8 space-y-6">
        <div
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h2 class="text-lg font-bold text-white flex items-center gap-2">
              <UIcon
                name="i-heroicons-sparkles"
                class="w-5 h-5 glide-a1"
              />
              Discord Visual Rank Card
            </h2>
            <p class="text-xs glide-ink-3 mt-0.5">
              Rendered visual banner generated for
              <code class="glide-a1">/rank</code> in Discord
            </p>
          </div>
          <a
            :href="rankCardRenderUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="glide-btn glide-btn-ghost !min-h-0 !px-3.5 !py-1.5 text-xs font-semibold self-start sm:self-auto"
          >
            <UIcon
              name="i-heroicons-arrow-top-right-on-square"
              class="w-4 h-4"
            />
            Open Full Size
          </a>
        </div>

        <div
          class="glide-tile rounded-2xl overflow-hidden flex items-center justify-center p-2"
        >
          <img
            :src="rankCardRenderUrl"
            :alt="`${data.user.username}'s Rank Card`"
            class="w-full max-w-2xl h-auto rounded-xl object-contain shadow-lg"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

definePageMeta({
  layout: "landing",
});

interface XpUserProfileResponse {
  guild: {
    id: string;
    name: string;
    icon: string | null;
    memberCount: number;
  };
  user: {
    userId: string;
    guildId: string;
    username: string;
    avatar: string | null;
    xp: number;
    level: number;
    rank: number;
    messageCount: number;
    charCount: number;
    lastXpGainAt: Date | string | null;
    notificationPref: string;
    optedIn: boolean;
    hiddenFromLeaderboard: boolean;
    progressPercent: number;
    currentLevelBaseXp: number;
    nextLevelBaseXp: number;
    xpInCurrentLevel: number;
    xpNeededForNextLevel: number;
  };
  totalTrackedMembers: number;
}

const route = useRoute();
const guildId = computed(() => String(route.params.guild_id));
const userId = computed(() => String(route.params.user_id));

const { data, pending, error } = await useFetch<XpUserProfileResponse>(
  () => `/api/xp/${guildId.value}/${userId.value}`,
);

const copied = ref(false);

function copyProfileLink() {
  if (typeof window === "undefined") return;
  navigator.clipboard.writeText(window.location.href);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

function getAvatarUrl(uid?: string, avatar?: string | null) {
  if (avatar) {
    if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
      return avatar;
    }
    const ext = avatar.startsWith("a_") ? "gif" : "webp";
    return `https://cdn.discordapp.com/avatars/${uid}/${avatar}.${ext}?size=128`;
  }
  if (!uid) return "https://cdn.discordapp.com/embed/avatars/0.png";
  try {
    const num = Number((BigInt(uid) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${num}.png`;
  } catch {
    const num = (parseInt(uid.slice(-2), 10) || 0) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${num}.png`;
  }
}

const rankCardRenderUrl = computed(() => {
  if (!data.value?.user) return "";
  return `/api/xp/${guildId.value}/${userId.value}/card`;
});

function formatNumber(n?: number) {
  return (n || 0).toLocaleString("en-US");
}

function calculateTopPercent(rank: number, total: number) {
  if (!total || total <= 0) return 1;
  const pct = Math.ceil((rank / total) * 100);
  return Math.max(1, Math.min(100, pct));
}

// Top three take a metal; everyone else falls back to the teal accent.
function rankMetalClass(rank: number) {
  return rank >= 1 && rank <= 3 ? `glide-metal-${rank}` : "";
}

function avatarRingClass(rank: number) {
  return `glide-podium-ring ${rankMetalClass(rank)}`;
}

const profileStats = computed(() => {
  const user = data.value?.user;
  if (!user) return [];
  return [
    {
      label: "Server Rank",
      icon: "i-heroicons-trophy",
      value: `#${user.rank}`,
      caption: `Top ${calculateTopPercent(user.rank, data.value?.totalTrackedMembers ?? 0)}% of members`,
    },
    {
      label: "Level",
      icon: "i-heroicons-sparkles",
      value: user.level,
      caption: `${formatNumber(user.xp)} Lifetime XP`,
    },
    {
      label: "Messages",
      icon: "i-heroicons-chat-bubble-left-right",
      value: formatNumber(user.messageCount),
      caption: "Messages recorded",
    },
    {
      label: "Characters",
      icon: "i-heroicons-document-text",
      value: formatNumber(user.charCount),
      caption: "Characters typed",
    },
  ];
});

useHead(() => {
  const username = data.value?.user?.username || "Member";
  const guildName = data.value?.guild?.name || "Server";
  return {
    title: `${username} • ${guildName} XP Rank • MODUS`,
    meta: [
      {
        name: "description",
        content: `View ${username}'s XP ranking, level progression, and stats in ${guildName}.`,
      },
    ],
  };
});
</script>
