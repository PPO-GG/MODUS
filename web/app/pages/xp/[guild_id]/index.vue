<template>
  <div class="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-12 mt-12">
    <!-- PRIVATE LEADERBOARD NOTICE -->
    <div
      v-if="data?.isPrivate"
      class="py-20 text-center space-y-6 max-w-lg mx-auto"
    >
      <div
        class="glide-icon w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
      >
        <UIcon name="i-heroicons-lock-closed" class="w-8 h-8" />
      </div>

      <!-- Gated: Requires Discord Login -->
      <div v-if="data?.requiresAuth" class="space-y-4">
        <div class="space-y-2">
          <h2 class="text-2xl font-bold text-white tracking-tight">
            Members-Only Leaderboard
          </h2>
          <p class="text-sm glide-ink-3 leading-relaxed">
            This server's leaderboard is private and only visible to verified server members. Log in with Discord to verify your membership and view your server's rankings.
          </p>
        </div>
        <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a :href="discordLoginUrl" class="glide-btn font-semibold">
            <UIcon name="i-simple-icons-discord" class="w-4 h-4" />
            Log In with Discord
          </a>
          <NuxtLink to="/xp" class="glide-btn glide-btn-ghost">
            <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
            Explore Public Leaderboards
          </NuxtLink>
        </div>
      </div>

      <!-- Logged in but not a member of this server -->
      <div v-else-if="data?.notMember" class="space-y-4">
        <div class="space-y-2">
          <h2 class="text-2xl font-bold text-white tracking-tight">
            Server Membership Required
          </h2>
          <p class="text-sm glide-ink-3 leading-relaxed">
            You are logged in, but you don't have active XP or membership in this server. Join the Discord server and chat to earn XP and view member rankings!
          </p>
        </div>
        <div class="pt-2">
          <NuxtLink to="/xp" class="glide-btn">
            <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
            Explore Public Leaderboards
          </NuxtLink>
        </div>
      </div>

      <!-- Generic Private fallback -->
      <div v-else class="space-y-4">
        <div class="space-y-2">
          <h2 class="text-2xl font-bold text-white tracking-tight">
            This Leaderboard is Private
          </h2>
          <p class="text-sm glide-ink-3 leading-relaxed">
            The server owner has configured this leaderboard to be viewable only by server members internally via bot commands (<code class="glide-a1 font-mono">/rank</code>, <code class="glide-a1 font-mono">/xp leaderboard</code>).
          </p>
        </div>
        <div class="pt-2">
          <NuxtLink to="/xp" class="glide-btn">
            <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
            Explore Public Leaderboards
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- PUBLIC / UNLISTED LEADERBOARD VIEW -->
    <template v-else>
      <!-- HERO SECTION -->
      <div class="text-center space-y-4 pt-4">
        <div class="glide-glass w-24 h-24 mx-auto mb-4">
          <div
            class="glide-icon w-24 h-24 rounded-xl overflow-hidden flex items-center justify-center"
          >
            <img
              v-if="data?.guild?.icon"
              :src="guildIconUrl"
              :alt="data.guild.name"
              class="w-full h-full object-cover"
            />
            <UIcon
              v-else
              name="i-heroicons-server-stack"
              class="w-10 h-10"
            />
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-center gap-2">
            <div
              class="glide-chip px-3 py-1 text-xs font-semibold uppercase tracking-wider"
            >
              <UIcon name="i-heroicons-trophy" class="w-3.5 h-3.5" />
              Server Leaderboard
            </div>
            <div
              v-if="data?.visibility === 'unlisted'"
              class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-medium"
            >
              <UIcon name="i-heroicons-link" class="w-3 h-3" />
              Unlisted
            </div>
          </div>
          <h1 class="text-3xl sm:text-5xl font-black text-white tracking-tight">
            {{ data?.guild?.name || "Server Leaderboard" }}
          </h1>
          <p class="text-sm sm:text-base glide-ink-3 max-w-xl mx-auto">
            Top active members ranked by message activity and XP. Chat in the
            server to <span class="glide-text">climb the leaderboard</span>!
          </p>
        </div>

      <!-- Quick Stats Badges -->
      <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
        <div
          v-for="stat in quickStats"
          :key="stat.label"
          class="glide-tile px-4 py-2 rounded-xl flex items-center gap-2.5"
        >
          <UIcon :name="stat.icon" class="glide-a1 text-lg" />
          <div class="text-left">
            <p
              class="text-[10px] glide-ink-4 font-bold uppercase tracking-wider"
            >
              {{ stat.label }}
            </p>
            <p class="text-sm font-black text-white">
              {{ formatNumber(stat.value || 0) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- TOP 3 PODIUM (if page === 1 and no active search) -->
    <div
      v-if="page === 1 && !searchQuery && podium.length >= 3"
      class="grid grid-cols-1 md:grid-cols-3 gap-8 items-end pt-4"
    >
      <!-- 2nd Place (Silver) -->
      <NuxtLink
        :to="`/xp/${guildId}/${podium[1]?.userId}`"
        class="glide-glass glide-podium glide-metal-2 order-2 md:order-1 p-6 space-y-4 text-center cursor-pointer"
      >
        <div
          class="glide-podium-medal absolute -top-5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 whitespace-nowrap"
        >
          🥈 #2 Silver
        </div>
        <div
          class="glide-podium-ring w-20 h-20 mx-auto rounded-full p-1 bg-[var(--glide-bg)] overflow-hidden mt-2"
        >
          <img
            :src="getAvatarUrl(podium[1]?.userId, podium[1]?.avatar)"
            :alt="podium[1]?.username"
            class="w-full h-full rounded-full object-cover"
          />
        </div>
        <div>
          <h3 class="font-bold text-white text-lg truncate">
            {{ podium[1]?.username }}
          </h3>
          <p class="text-xs font-semibold" style="color: var(--metal)">
            Level {{ podium[1]?.level }} • {{ formatNumber(podium[1]?.xp) }} XP
          </p>
        </div>
        <div class="space-y-1">
          <div class="glide-bar-track w-full h-2">
            <div
              class="glide-bar-fill"
              :style="{ width: `${podium[1]?.progressPercent}%` }"
            />
          </div>
          <p class="text-[10px] glide-ink-4">
            {{ podium[1]?.progressPercent }}% to Level
            {{ (podium[1]?.level || 0) + 1 }}
          </p>
        </div>
      </NuxtLink>

      <!-- 1st Place (Gold) -->
      <NuxtLink
        :to="`/xp/${guildId}/${podium[0]?.userId}`"
        class="glide-glass glide-podium glide-podium-first glide-metal-1 order-1 md:order-2 p-8 space-y-5 text-center cursor-pointer md:-translate-y-4"
      >
        <div
          class="glide-podium-medal absolute -top-6 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-sm font-black flex items-center gap-1.5 whitespace-nowrap"
        >
          👑 #1 Champion
        </div>
        <div
          class="glide-podium-ring w-24 h-24 mx-auto rounded-full p-1 bg-[var(--glide-bg)] overflow-hidden mt-3"
        >
          <img
            :src="getAvatarUrl(podium[0]?.userId, podium[0]?.avatar)"
            :alt="podium[0]?.username"
            class="w-full h-full rounded-full object-cover"
          />
        </div>
        <div>
          <h3 class="font-black text-white text-xl truncate">
            {{ podium[0]?.username }}
          </h3>
          <span
            class="glide-chip px-2.5 py-0.5 mt-1 text-xs font-bold"
          >
            Level {{ podium[0]?.level }} • {{ formatNumber(podium[0]?.xp) }} XP
          </span>
        </div>
        <div class="space-y-1.5">
          <div class="glide-bar-track w-full h-2.5">
            <div
              class="glide-bar-fill"
              :style="{ width: `${podium[0]?.progressPercent}%` }"
            />
          </div>
          <p class="text-xs glide-ink-3 font-medium">
            {{ podium[0]?.progressPercent }}% to Level
            {{ (podium[0]?.level || 0) + 1 }}
          </p>
        </div>
      </NuxtLink>

      <!-- 3rd Place (Bronze) -->
      <NuxtLink
        :to="`/xp/${guildId}/${podium[2]?.userId}`"
        class="glide-glass glide-podium glide-metal-3 order-3 p-6 space-y-4 text-center cursor-pointer"
      >
        <div
          class="glide-podium-medal absolute -top-5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 whitespace-nowrap"
        >
          🥉 #3 Bronze
        </div>
        <div
          class="glide-podium-ring w-20 h-20 mx-auto rounded-full p-1 bg-[var(--glide-bg)] overflow-hidden mt-2"
        >
          <img
            :src="getAvatarUrl(podium[2]?.userId, podium[2]?.avatar)"
            :alt="podium[2]?.username"
            class="w-full h-full rounded-full object-cover"
          />
        </div>
        <div>
          <h3 class="font-bold text-white text-lg truncate">
            {{ podium[2]?.username }}
          </h3>
          <p class="text-xs font-semibold" style="color: var(--metal)">
            Level {{ podium[2]?.level }} • {{ formatNumber(podium[2]?.xp) }} XP
          </p>
        </div>
        <div class="space-y-1">
          <div class="glide-bar-track w-full h-2">
            <div
              class="glide-bar-fill"
              :style="{ width: `${podium[2]?.progressPercent}%` }"
            />
          </div>
          <p class="text-[10px] glide-ink-4">
            {{ podium[2]?.progressPercent }}% to Level
            {{ (podium[2]?.level || 0) + 1 }}
          </p>
        </div>
      </NuxtLink>
    </div>

    <!-- MAIN LEADERBOARD CARD -->
    <div class="glide-glass p-6 sm:p-8 space-y-6">
      <!-- Search & Filters -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="w-full sm:w-80 relative">
          <UInput
            v-model="searchQuery"
            icon="i-heroicons-magnifying-glass"
            placeholder="Search member by username or ID..."
            size="md"
            class="w-full"
          />
        </div>

        <div class="text-xs glide-ink-3 flex items-center gap-2">
          <span
            >Showing <strong>{{ data?.users?.length || 0 }}</strong> of
            <strong>{{ formatNumber(data?.total || 0) }}</strong> ranked
            members</span
          >
        </div>
      </div>

      <!-- Leaderboard List / Table -->
      <div class="space-y-2">
        <NuxtLink
          v-for="user in data?.users"
          :key="user.id"
          :to="`/xp/${guildId}/${user.userId}`"
          class="glide-tile flex items-center gap-4 p-3.5 sm:p-4 rounded-2xl cursor-pointer group"
        >
          <!-- Rank Badge -->
          <div
            class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm"
            :class="rankBadgeClass(user.rank)"
          >
            <span v-if="user.rank === 1">🥇</span>
            <span v-else-if="user.rank === 2">🥈</span>
            <span v-else-if="user.rank === 3">🥉</span>
            <span v-else>#{{ user.rank }}</span>
          </div>

          <!-- Avatar -->
          <div
            class="w-10 h-10 sm:w-11 sm:h-11 rounded-full ring-2 ring-white/10 group-hover:ring-teal-400/50 p-0.5 bg-[var(--glide-bg)] shrink-0 overflow-hidden transition-colors"
          >
            <img
              :src="getAvatarUrl(user.userId, user.avatar)"
              :alt="user.username"
              class="w-full h-full rounded-full object-cover"
            />
          </div>

          <!-- Username & Subtitle -->
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p
                class="font-bold text-white text-sm sm:text-base truncate group-hover:text-teal-300 transition-colors"
              >
                {{ user.username }}
              </p>
              <UBadge
                color="primary"
                variant="subtle"
                size="xs"
                class="hidden sm:inline-flex"
              >
                Level {{ user.level }}
              </UBadge>
            </div>
            <p class="text-xs glide-ink-4 truncate sm:hidden">
              Level {{ user.level }} • {{ formatNumber(user.xp) }} XP
            </p>
          </div>

          <!-- Progress Bar (Desktop) -->
          <div class="hidden md:block w-48 space-y-1">
            <div
              class="flex justify-between text-[11px] glide-ink-3 font-medium"
            >
              <span>Progress</span>
              <span>{{ user.progressPercent }}%</span>
            </div>
            <div class="glide-bar-track w-full h-2">
              <div
                class="glide-bar-fill"
                :style="{ width: `${user.progressPercent}%` }"
              />
            </div>
          </div>

          <!-- XP Count -->
          <div class="text-right shrink-0">
            <p class="font-black text-white text-sm sm:text-base tabular-nums">
              {{ formatNumber(user.xp) }}
              <span class="text-[10px] font-bold glide-a1 uppercase ml-0.5"
                >XP</span
              >
            </p>
            <p class="text-[10px] glide-ink-4 hidden sm:block">
              {{ formatNumber(user.messageCount) }} messages
            </p>
          </div>

          <UIcon
            name="i-heroicons-chevron-right"
            class="w-4 h-4 glide-ink-4 group-hover:text-white transition-colors shrink-0"
          />
        </NuxtLink>

        <div
          v-if="!data?.users?.length"
          class="text-center py-12 glide-ink-4"
        >
          <UIcon
            name="i-heroicons-trophy"
            class="w-10 h-10 mx-auto mb-2 opacity-40"
          />
          <p class="text-base font-bold glide-ink-3">No members found</p>
          <p class="text-xs glide-ink-4">
            Try adjusting your search query or start chatting in the server
          </p>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="data && data.totalPages > 1"
        class="glide-rule flex items-center justify-between pt-4 border-t"
      >
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-heroicons-chevron-left"
          :disabled="page <= 1"
          @click="page--"
        >
          Previous
        </UButton>

        <span class="text-xs font-semibold glide-ink-3">
          Page <strong class="text-white">{{ page }}</strong> of
          <strong class="text-white">{{ data.totalPages }}</strong>
        </span>

        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          trailing-icon="i-heroicons-chevron-right"
          :disabled="page >= data.totalPages"
          @click="page++"
        >
          Next
        </UButton>
      </div>
    </div>

    <!-- USER DETAIL MODAL -->
    <UModal v-model="isModalOpen">
      <template #content>
        <div
          class="glide-rule p-6 bg-[var(--glide-bg)] border rounded-2xl space-y-6 text-center"
        >
          <div v-if="selectedUser" class="space-y-4">
            <div
              class="w-20 h-20 mx-auto rounded-full ring-4 ring-teal-400/40 p-1 bg-[var(--glide-bg)] overflow-hidden"
            >
              <img
                :src="getAvatarUrl(selectedUser.userId, selectedUser.avatar)"
                :alt="selectedUser.username"
                class="w-full h-full rounded-full object-cover"
              />
            </div>
            <div>
              <h3 class="text-xl font-black text-white">
                {{ selectedUser.username }}
              </h3>
              <p class="text-xs glide-ink-3">
                Rank #{{ selectedUser.rank }} in {{ data?.guild?.name }}
              </p>
            </div>

            <div class="grid grid-cols-3 gap-2 py-2">
              <div class="glide-tile p-3 rounded-xl">
                <p class="text-[10px] glide-ink-4 font-bold uppercase">
                  Level
                </p>
                <p class="text-lg font-black glide-a1">
                  {{ selectedUser.level }}
                </p>
              </div>
              <div class="glide-tile p-3 rounded-xl">
                <p class="text-[10px] glide-ink-4 font-bold uppercase">
                  Total XP
                </p>
                <p class="text-lg font-black glide-a2">
                  {{ formatNumber(selectedUser.xp) }}
                </p>
              </div>
              <div class="glide-tile p-3 rounded-xl">
                <p class="text-[10px] glide-ink-4 font-bold uppercase">
                  Messages
                </p>
                <p class="text-lg font-black text-white">
                  {{ formatNumber(selectedUser.messageCount) }}
                </p>
              </div>
            </div>

            <div class="glide-tile space-y-2 text-left p-4 rounded-xl">
              <div class="flex justify-between text-xs font-semibold">
                <span class="glide-ink-3">Next Level Progress</span>
                <span class="glide-a1"
                  >{{ selectedUser.progressPercent }}%</span
                >
              </div>
              <div class="glide-bar-track w-full h-2.5">
                <div
                  class="glide-bar-fill"
                  :style="{ width: `${selectedUser.progressPercent}%` }"
                />
              </div>
              <p class="text-[11px] glide-ink-4">
                {{ formatNumber(selectedUser.xpInCurrentLevel) }} /
                {{ formatNumber(selectedUser.xpNeededForNextLevel) }} XP to
                Level {{ selectedUser.level + 1 }}
              </p>
            </div>

            <div class="pt-2">
              <NuxtLink
                :to="`/xp/${guildId}/${selectedUser.userId}`"
                class="glide-btn w-full justify-center text-xs font-semibold group"
              >
                <span>View Full Member Profile</span>
                <UIcon name="i-heroicons-arrow-right" class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </NuxtLink>
            </div>
          </div>
        </div>
      </template>
    </UModal>
    </template>
  </div>
</template>


<script setup lang="ts">
import { ref, computed, watch } from "vue";

// Use the sleek Landing page layout requested by the user
definePageMeta({
  layout: "landing",
});

const route = useRoute();
const guildId = computed(() => String(route.params.guild_id));

const discordLoginUrl = computed(
  () => `/api/auth/discord?returnTo=${encodeURIComponent(route.fullPath)}`,
);

const page = ref(1);
const searchQuery = ref("");
const selectedUser = ref<any | null>(null);
const isModalOpen = ref(false);

const { data } = await useFetch(() => `/api/xp/${guildId.value}/leaderboard`, {
  query: {
    page,
    search: searchQuery,
  },
  watch: [page, searchQuery],
});

const guildIconUrl = computed(() => {
  const icon = data.value?.guild?.icon;
  if (!icon) return undefined;
  return `https://cdn.discordapp.com/icons/${guildId.value}/${icon}.png?size=128`;
});

const podium = computed(() => {
  return data.value?.top3 || [];
});

function getAvatarUrl(userId?: string, avatar?: string | null) {
  if (avatar) {
    if (avatar.startsWith("http://") || avatar.startsWith("https://")) {
      return avatar;
    }
    const ext = avatar.startsWith("a_") ? "gif" : "webp";
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=128`;
  }
  if (!userId) return "https://cdn.discordapp.com/embed/avatars/0.png";
  try {
    const num = Number((BigInt(userId) >> 22n) % 6n);
    return `https://cdn.discordapp.com/embed/avatars/${num}.png`;
  } catch {
    const num = (parseInt(userId.slice(-2), 10) || 0) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${num}.png`;
  }
}

function formatNumber(n: number) {
  return (n || 0).toLocaleString("en-US");
}

const quickStats = computed(() => {
  const stats = data.value?.stats;
  return [
    {
      label: "Ranked Members",
      icon: "i-heroicons-users",
      value: stats?.totalTrackedMembers,
    },
    {
      label: "Total XP Earned",
      icon: "i-heroicons-bolt",
      value: stats?.totalXp,
    },
    {
      label: "Messages Counted",
      icon: "i-heroicons-chat-bubble-left-right",
      value: stats?.totalMessages,
    },
  ];
});

function rankBadgeClass(rank: number) {
  return rank >= 1 && rank <= 3
    ? `glide-rank glide-metal-${rank}`
    : "glide-rank";
}

function openUserCard(user: any) {
  selectedUser.value = user;
  isModalOpen.value = true;
}

const leaderboardDescription = computed(() =>
  `XP leaderboard for ${data.value?.guild?.name || "this Discord server"} — see the most active members, levels and ranks. Powered by MODUS.`,
);
useSeoMeta({
  description: leaderboardDescription,
  ogTitle: () => `${data.value?.guild?.name || "Server"} XP Leaderboard`,
  ogDescription: leaderboardDescription,
});
// Private boards get no podium in the payload, so the card degrades to just
// the server name — never leaks members.
defineOgImage("XpLeaderboard", {
  guildName: data.value?.guild?.name || "Discord Server",
  iconUrl: guildIconUrl.value ?? "",
  top: (podium.value as { username?: string; level?: number }[])
    .slice(0, 3)
    .map((m) => ({ username: m.username ?? "Unknown", level: m.level ?? 0 })),
});

useHead(() => {
  const isUnlisted = data.value?.visibility === "unlisted";
  const isPrivate = data.value?.isPrivate || data.value?.visibility === "private";
  return {
    title: `${data.value?.guild?.name || "XP"} Leaderboard`,
    meta: [
      ...(isUnlisted || isPrivate
        ? [{ name: "robots", content: "noindex, nofollow" }]
        : []),
    ],
  };
});
</script>
