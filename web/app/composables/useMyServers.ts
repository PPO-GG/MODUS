/**
 * The signed-in user's MODUS servers, shared between the dashboard rail and
 * the /dashboard home so both render from one fetch. Icons missing from the
 * DB row are backfilled from the user's Discord guild list at display time
 * (the bot's updateServerStatus hook writes the real icon later).
 */
let inflight: Promise<void> | null = null;

export function useMyServers() {
  const servers = useState<any[]>("my-servers", () => []);
  const loading = useState<boolean>("my-servers-loading", () => false);
  const userStore = useUserStore();

  function refresh(): Promise<void> {
    if (!userStore.user) return Promise.resolve();
    if (inflight) return inflight;
    inflight = doRefresh().finally(() => {
      inflight = null;
    });
    return inflight;
  }

  async function doRefresh() {
    loading.value = true;
    try {
      const list = await $fetch<any[]>("/api/servers/my-servers", {
        credentials: "include",
      });
      const discordGuilds = (userStore.userGuilds || []) as any[];
      for (const server of list) {
        if (!server.icon) {
          const guild = discordGuilds.find(
            (g) => g.id === (server.guild_id ?? server.$id),
          );
          if (guild?.icon) server.icon = guild.icon;
        }
      }
      servers.value = list;
    } catch (error) {
      console.error("Error fetching servers:", error);
    } finally {
      loading.value = false;
    }
  }

  return { servers, loading, refresh };
}
