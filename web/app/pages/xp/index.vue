<template>
  <div class="py-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-12 mt-12">
    <!-- HERO SECTION -->
    <div class="text-center space-y-4 pt-4">
      <div
        class="glide-chip px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider"
      >
        <UIcon name="i-heroicons-globe-alt" class="w-4 h-4" />
        Public Server Directory
      </div>

      <h1 class="text-4xl sm:text-6xl font-black text-white tracking-tight">
        Server XP <span class="glide-text">Leaderboards</span>
      </h1>
      <p class="text-sm sm:text-base glide-ink-3 max-w-2xl mx-auto">
        Discover top Discord communities powered by MODUS ranked by cumulative
        server XP, active leveling members, and community message activity.
      </p>

      <!-- Global Stats Cards -->
      <div class="flex flex-wrap items-center justify-center gap-4 pt-4">
        <div
          v-for="stat in globalStats"
          :key="stat.label"
          class="glide-tile px-5 py-3 rounded-2xl flex items-center gap-3"
        >
          <div
            class="glide-icon w-10 h-10 rounded-xl flex items-center justify-center"
          >
            <UIcon :name="stat.icon" class="text-xl" />
          </div>
          <div class="text-left">
            <p
              class="text-[10px] glide-ink-4 font-bold uppercase tracking-wider"
            >
              {{ stat.label }}
            </p>
            <p class="text-lg font-black text-white">
              {{ formatNumber(stat.value) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- YOUR SERVERS (client-only: depends on session state SSR never has,
         and starting the skeleton at setup-time would otherwise mismatch
         the server-rendered HTML) -->
    <ClientOnly>
    <div v-if="myServersLoading" class="space-y-4">
      <h2 class="text-lg font-bold text-white tracking-tight flex items-center gap-2">
        <UIcon name="i-heroicons-user-circle" class="w-5 h-5 glide-a1" />
        Your Servers
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="n in 3"
          :key="n"
          class="glide-tile flex items-center gap-3 p-4 rounded-2xl animate-pulse"
        >
          <div class="w-11 h-11 rounded-xl bg-white/10 shrink-0" />
          <div class="min-w-0 flex-1 space-y-2">
            <div class="h-3.5 w-2/3 rounded-full bg-white/10" />
            <div class="h-3 w-1/3 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    </div>

    <!-- YOUR SERVERS -->
    <div v-else-if="userStore.initialized && userStore.isLoggedIn && myServers.length > 0" class="space-y-4">
      <h2 class="text-lg font-bold text-white tracking-tight flex items-center gap-2">
        <UIcon name="i-heroicons-user-circle" class="w-5 h-5 glide-a1" />
        Your Servers
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink
          v-for="server in myServers"
          :key="server.guildId"
          :to="`/xp/${server.guildId}`"
          class="glide-tile flex items-center gap-3 p-4 rounded-2xl group"
        >
          <div
            class="w-11 h-11 rounded-xl glide-icon overflow-hidden shrink-0 flex items-center justify-center"
          >
            <img
              v-if="server.icon"
              :src="getServerIconUrl(server.guildId, server.icon)"
              :alt="server.name"
              class="w-full h-full object-cover"
            />
            <UIcon
              v-else
              name="i-heroicons-server-stack"
              class="w-5 h-5"
            />
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-bold text-white text-sm truncate group-hover:text-teal-300 transition-colors">
              {{ server.name }}
            </p>
            <p class="text-xs glide-ink-3">
              <template v-if="server.rankedYet">
                Level {{ server.level }} • {{ formatNumber(server.xp) }} XP
              </template>
              <template v-else>Not ranked yet</template>
            </p>
          </div>
          <UBadge
            v-if="server.visibility !== 'public'"
            color="neutral"
            variant="subtle"
            size="xs"
            class="shrink-0"
          >
            {{ server.visibility === "private" ? "Private" : "Unlisted" }}
          </UBadge>
        </NuxtLink>
      </div>
    </div>

    <!-- YOUR SERVERS: LIST COULDN'T BE BUILT -->
    <div
      v-else-if="userStore.initialized && userStore.isLoggedIn && myServersError"
      class="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20"
    >
      <div class="flex items-center gap-3">
        <UIcon
          name="i-heroicons-exclamation-triangle"
          class="w-6 h-6 text-amber-400 shrink-0"
        />
        <p class="text-sm glide-ink-2">
          <template v-if="myServersError === 'reauth'">
            Your Discord connection has expired. Log in again to see the
            servers you're ranked in.
          </template>
          <template v-else>
            Couldn't reach Discord just now, so we can't tell which servers
            you're in.
          </template>
        </p>
      </div>
      <UButton
        v-if="myServersError === 'reauth'"
        :href="`/api/auth/discord?returnTo=${encodeURIComponent('/xp')}`"
        external
        color="warning"
        variant="soft"
        size="sm"
        icon="i-simple-icons-discord"
        class="shrink-0"
      >
        Reconnect Discord
      </UButton>
      <UButton
        v-else
        color="warning"
        variant="soft"
        size="sm"
        icon="i-heroicons-arrow-path"
        class="shrink-0"
        @click="retryMyServers"
      >
        Try Again
      </UButton>
    </div>

    <!-- YOUR SERVERS: NONE RUNNING MODUS XP -->
    <div
      v-else-if="userStore.initialized && userStore.isLoggedIn"
      class="glide-tile flex items-center gap-3 p-5 rounded-2xl"
    >
      <UIcon
        name="i-heroicons-user-circle"
        class="w-6 h-6 glide-a1 shrink-0"
      />
      <p class="text-sm glide-ink-3">
        None of the servers you're in are running MODUS XP yet. Browse the
        public leaderboards below, or add MODUS to a server you manage.
      </p>
    </div>

    <!-- YOUR SERVERS: LOGGED OUT PROMPT -->
    <div
      v-else-if="userStore.initialized && !userStore.isLoggedIn"
      class="glide-tile flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl"
    >
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-user-circle" class="w-6 h-6 glide-a1 shrink-0" />
        <p class="text-sm glide-ink-2">
          Log in with Discord to jump straight to the servers you're already ranked in.
        </p>
      </div>
      <a
        :href="`/api/auth/discord?returnTo=${encodeURIComponent('/xp')}`"
        class="glide-btn shrink-0"
      >
        <UIcon name="i-simple-icons-discord" class="w-4 h-4" />
        Log In with Discord
      </a>
    </div>
    </ClientOnly>

    <!-- TOP 3 SERVERS PODIUM (if page === 1 and no active search) -->
    <div
      v-if="page === 1 && !searchQuery && podium.length >= 3"
      class="grid grid-cols-1 md:grid-cols-3 gap-8 items-end pt-4"
    >
      <!-- 2nd Place (Silver) -->
      <div
        class="glide-glass glide-podium glide-metal-2 order-2 md:order-1 p-6 space-y-4 text-center"
      >
        <div
          class="glide-podium-medal absolute -top-5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 whitespace-nowrap"
        >
          🥈 #2 Server
        </div>
        <div
          class="glide-podium-ring w-20 h-20 mx-auto rounded-2xl p-1 bg-[var(--glide-bg)] overflow-hidden mt-2 flex items-center justify-center"
        >
          <img
            v-if="podium[1]?.icon"
            :src="getServerIconUrl(podium[1]?.guildId, podium[1]?.icon)"
            :alt="podium[1]?.name"
            class="w-full h-full rounded-xl object-cover"
          />
          <UIcon
            v-else
            name="i-heroicons-server-stack"
            class="w-10 h-10 glide-ink-3"
          />
        </div>
        <div>
          <h3 class="font-bold text-white text-lg truncate">
            {{ podium[1]?.name }}
          </h3>
          <p class="text-xs font-semibold" style="color: var(--metal)">
            {{ formatNumber(podium[1]?.totalXp) }} XP
          </p>
          <span
            class="glide-chip mt-1.5 px-2.5 py-0.5 text-[11px] font-medium"
          >
            {{ formatNumber(podium[1]?.activeMembers) }} members •
            {{ formatNumber(podium[1]?.totalMessages) }} msgs
          </span>
        </div>
        <div class="pt-2">
          <NuxtLink
            :to="`/xp/${podium[1]?.guildId}`"
            class="glide-btn glide-btn-ghost w-full justify-center text-sm"
          >
            View Server Leaderboard
          </NuxtLink>
        </div>
      </div>

      <!-- 1st Place (Gold) -->
      <div
        class="glide-glass glide-podium glide-podium-first glide-metal-1 order-1 md:order-2 p-7 space-y-4 text-center md:-translate-y-4"
      >
        <div
          class="glide-podium-medal absolute -top-6 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1 whitespace-nowrap"
        >
          <UIcon name="i-heroicons-trophy" class="w-3.5 h-3.5" />
          🏆 #1 Champion
        </div>
        <div
          class="glide-podium-ring w-24 h-24 mx-auto rounded-2xl p-1 bg-[var(--glide-bg)] overflow-hidden mt-3 flex items-center justify-center"
        >
          <img
            v-if="podium[0]?.icon"
            :src="getServerIconUrl(podium[0]?.guildId, podium[0]?.icon)"
            :alt="podium[0]?.name"
            class="w-full h-full rounded-xl object-cover"
          />
          <UIcon
            v-else
            name="i-heroicons-server-stack"
            class="w-12 h-12 glide-a1"
          />
        </div>
        <div>
          <h3 class="font-black text-white text-xl truncate">
            {{ podium[0]?.name }}
          </h3>
          <p class="text-sm font-bold" style="color: var(--metal)">
            {{ formatNumber(podium[0]?.totalXp) }} Total XP
          </p>
          <span
            class="glide-chip mt-1.5 px-3 py-0.5 text-xs font-semibold"
          >
            {{ formatNumber(podium[0]?.activeMembers) }} members •
            {{ formatNumber(podium[0]?.totalMessages) }} msgs
          </span>
        </div>
        <div class="pt-2">
          <NuxtLink
            :to="`/xp/${podium[0]?.guildId}`"
            class="glide-btn w-full justify-center font-bold"
          >
            View Server Leaderboard
          </NuxtLink>
        </div>
      </div>

      <!-- 3rd Place (Bronze) -->
      <div
        class="glide-glass glide-podium glide-metal-3 order-3 p-6 space-y-4 text-center"
      >
        <div
          class="glide-podium-medal absolute -top-5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 whitespace-nowrap"
        >
          🥉 #3 Server
        </div>
        <div
          class="glide-podium-ring w-20 h-20 mx-auto rounded-2xl p-1 bg-[var(--glide-bg)] overflow-hidden mt-2 flex items-center justify-center"
        >
          <img
            v-if="podium[2]?.icon"
            :src="getServerIconUrl(podium[2]?.guildId, podium[2]?.icon)"
            :alt="podium[2]?.name"
            class="w-full h-full rounded-xl object-cover"
          />
          <UIcon
            v-else
            name="i-heroicons-server-stack"
            class="w-10 h-10 glide-ink-3"
          />
        </div>
        <div>
          <h3 class="font-bold text-white text-lg truncate">
            {{ podium[2]?.name }}
          </h3>
          <p class="text-xs font-semibold" style="color: var(--metal)">
            {{ formatNumber(podium[2]?.totalXp) }} XP
          </p>
          <span
            class="glide-chip mt-1.5 px-2.5 py-0.5 text-[11px] font-medium"
          >
            {{ formatNumber(podium[2]?.activeMembers) }} members •
            {{ formatNumber(podium[2]?.totalMessages) }} msgs
          </span>
        </div>
        <div class="pt-2">
          <NuxtLink
            :to="`/xp/${podium[2]?.guildId}`"
            class="glide-btn glide-btn-ghost w-full justify-center text-sm"
          >
            View Server Leaderboard
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- SERVER LEADERBOARD DIRECTORY & SEARCH -->
    <div class="glide-glass p-6 sm:p-8 space-y-6">
      <!-- Table Header & Controls -->
      <div
        class="glide-rule flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6"
      >
        <div>
          <h2 class="text-xl font-bold text-white tracking-tight">
            All Public Discord Servers
          </h2>
          <p class="text-xs glide-ink-3">
            Click any server to browse its individual member leaderboard
          </p>
        </div>

        <div class="flex items-center gap-3">
          <div class="w-full sm:w-72">
            <UInput
              v-model="searchQuery"
              icon="i-heroicons-magnifying-glass"
              placeholder="Search public servers..."
              size="md"
              class="w-full"
            />
          </div>
        </div>
      </div>

      <!-- Servers List -->
      <div class="space-y-2">
        <NuxtLink
          v-for="server in data?.servers || []"
          :key="server.guildId"
          :to="`/xp/${server.guildId}`"
          class="glide-tile flex items-center gap-4 p-4 rounded-2xl group"
        >
          <!-- Rank Badge -->
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
            :class="rankBadgeClass(server.rank)"
          >
            #{{ server.rank }}
          </div>

          <!-- Server Icon -->
          <div
            class="w-12 h-12 rounded-xl glide-icon overflow-hidden shrink-0 flex items-center justify-center"
          >
            <img
              v-if="server.icon"
              :src="getServerIconUrl(server.guildId, server.icon)"
              :alt="server.name"
              class="w-full h-full object-cover"
            />
            <UIcon
              v-else
              name="i-heroicons-server-stack"
              class="w-6 h-6"
            />
          </div>

          <!-- Server Info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span
                class="font-bold text-white text-base truncate group-hover:text-teal-300 transition-colors"
              >
                {{ server.name }}
              </span>
              <UBadge
                color="primary"
                variant="subtle"
                size="xs"
                class="hidden sm:inline-flex"
              >
                Public
              </UBadge>
            </div>
            <div class="flex items-center gap-3 text-xs glide-ink-3 mt-0.5">
              <span class="flex items-center gap-1">
                <UIcon name="i-heroicons-users" class="w-3.5 h-3.5 glide-ink-4" />
                {{ formatNumber(server.activeMembers) }} members
              </span>
              <span>•</span>
              <span class="flex items-center gap-1">
                <UIcon
                  name="i-heroicons-chat-bubble-left-right"
                  class="w-3.5 h-3.5 glide-ink-4"
                />
                {{ formatNumber(server.totalMessages) }} messages
              </span>
            </div>
          </div>

          <!-- Cumulative XP -->
          <div class="text-right shrink-0">
            <p class="font-black text-white text-sm sm:text-base tabular-nums">
              {{ formatNumber(server.totalXp) }}
              <span class="text-[10px] font-bold glide-a1 uppercase ml-0.5"
                >XP</span
              >
            </p>
            <p class="text-[10px] glide-ink-4">
              Total Community XP
            </p>
          </div>

          <UIcon
            name="i-heroicons-chevron-right"
            class="w-4 h-4 glide-ink-4 group-hover:text-white transition-colors shrink-0"
          />
        </NuxtLink>

        <div
          v-if="!data?.servers?.length"
          class="text-center py-16 glide-ink-4 space-y-3"
        >
          <UIcon
            name="i-heroicons-server-stack"
            class="w-12 h-12 mx-auto glide-ink-4"
          />
          <div class="space-y-1">
            <p class="text-base font-bold glide-ink-2">No public servers found</p>
            <p class="text-xs glide-ink-4 max-w-sm mx-auto">
              Server owners can opt their server in by setting Leaderboard Visibility to <strong>Public</strong> in the MODUS dashboard!
            </p>
          </div>
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
  </div>
</template>


<script setup lang="ts">
import { ref, computed } from "vue";

definePageMeta({
  layout: "landing",
});

const page = ref(1);
const searchQuery = ref("");

const { data } = await useFetch("/api/xp/global", {
  query: {
    page,
    search: searchQuery,
  },
  watch: [page, searchQuery],
});

const userStore = useUserStore();
const myServers = ref<
  Array<{
    guildId: string;
    name: string;
    icon: string | null;
    visibility: "private" | "unlisted" | "public";
    xp: number;
    level: number;
    rankedYet: boolean;
  }>
>([]);
// Starts true (not gated on any session check) so the skeleton — and the
// layout space it reserves — is there from the very first client render.
// userStore.initialized only flips once /api/auth/session AND (for a
// logged-in caller) /api/discord/me's round trip to Discord's API have
// both resolved, which is the actual multi-second cost; waiting for that
// before even showing a skeleton is what made the section look absent
// and then shove the page layout down once it finally appeared. The
// section is wrapped in <ClientOnly> in the template, so this initial
// "true" never reaches SSR output for anonymous visitors — it only takes
// effect once the client has mounted and is about to check the session.
const myServersLoading = ref(true);

/**
 * Why the list couldn't be built. "reauth" means the Discord authorization
 * itself is dead and only logging in again fixes it; "unreachable" means
 * Discord (or we) failed transiently and retrying is worth a shot. Telling
 * them apart matters — offering "Reconnect Discord" for a rate limit sends
 * people through a login that cannot help.
 */
const myServersError = ref<"reauth" | "unreachable" | null>(null);

async function loadMyServers() {
  myServersLoading.value = true;
  myServersError.value = null;
  try {
    if (!userStore.isLoggedIn) return;

    // Reuse the guild list already fetched during session hydration
    // (userStore.init() -> /api/discord/me) instead of asking Discord
    // again — /users/@me/guilds is tightly rate-limited, and a second
    // near-simultaneous call to it reliably 429s. A list left over from a
    // previous visit is still worth using: the XP shown against each
    // server is read live from our own database either way.
    const guildIds = userStore.userGuilds.map((g) => g.id);
    if (guildIds.length === 0) {
      myServers.value = [];
      // The session survives a failed Discord hydration, so with no guild
      // list we can't tell "you're in none" from "we never got one" —
      // unless hydration told us it failed. Say so instead of rendering
      // nothing at all.
      if (userStore.discordSyncError) {
        myServersError.value =
          userStore.discordSyncError.code === "discord_token_expired"
            ? "reauth"
            : "unreachable";
      }
      return;
    }

    myServers.value = await $fetch("/api/xp/my-servers", {
      query: { guildIds: guildIds.join(",") },
    });
  } catch (err: any) {
    myServers.value = [];
    myServersError.value =
      err?.data?.data?.code === "discord_token_expired"
        ? "reauth"
        : "unreachable";
  } finally {
    myServersLoading.value = false;
  }
}

/** Re-hydrate the session first — the guild list usually came from there. */
async function retryMyServers() {
  myServersLoading.value = true;
  await userStore.fetchUserSession();
  await loadMyServers();
}

watch(
  () => userStore.initialized,
  async (ready) => {
    if (!ready) return;
    await loadMyServers();
  },
  { immediate: true },
);

const podium = computed(() => {
  return data.value?.top3 || [];
});

function getServerIconUrl(guildId?: string, icon?: string | null) {
  if (!guildId || !icon) return undefined;
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=128`;
}

function formatNumber(n?: number | null) {
  return (n || 0).toLocaleString("en-US");
}

const globalStats = computed(() => {
  const stats = data.value?.stats;
  return [
    {
      label: "Public Servers",
      icon: "i-heroicons-server-stack",
      value: stats?.totalGuilds,
    },
    {
      label: "Cumulative Server XP",
      icon: "i-heroicons-bolt",
      value: stats?.totalXp,
    },
    {
      label: "Active Members",
      icon: "i-heroicons-users",
      value: stats?.totalUsers,
    },
    {
      label: "Messages Tracked",
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

const XP_DESCRIPTION =
  "Browse public Discord server XP leaderboards powered by MODUS — see the most active communities and their top members.";
useSeoMeta({
  title: "Discord Server XP Leaderboards",
  description: XP_DESCRIPTION,
  ogTitle: "Discord Server XP Leaderboards — MODUS",
  ogDescription: XP_DESCRIPTION,
});
defineOgImage("Modus", {
  eyebrow: "XP Leaderboards",
  title: "The most active Discord servers",
  description: XP_DESCRIPTION,
});
</script>
