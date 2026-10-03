/**
 * useStarboardLeaderboard — loads the top posts / top authors for one board.
 * Board settings themselves go through useServerSettings's generic
 * saveModuleSettings/getModuleConfig, same as every other module.
 */
export interface LeaderboardPost {
  id: string;
  sourceChannelId: string;
  sourceMessageId: string;
  boardMessageId: string | null;
  authorId: string;
  authorName: string;
  starCount: number;
  createdAt: string;
}

export interface LeaderboardAuthor {
  authorId: string;
  authorName: string;
  posts: number;
  stars: number;
}

export interface Leaderboard {
  posts: LeaderboardPost[];
  authors: LeaderboardAuthor[];
}

export function useStarboardLeaderboard(guildId: string) {
  const leaderboard = ref<Leaderboard | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchLeaderboard = async (boardId: string) => {
    loading.value = true;
    error.value = null;
    try {
      leaderboard.value = (await $fetch("/api/starboard/leaderboard", {
        params: { guild_id: guildId, board_id: boardId },
      })) as Leaderboard;
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || "Failed to load the leaderboard";
      leaderboard.value = null;
    } finally {
      loading.value = false;
    }
  };

  return { leaderboard, loading, error, fetchLeaderboard };
}
