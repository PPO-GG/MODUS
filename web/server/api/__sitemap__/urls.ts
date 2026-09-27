/**
 * GET /api/__sitemap__/urls
 *
 * Dynamic sitemap source for @nuxtjs/sitemap: one entry per documented bot
 * module plus every XP leaderboard whose visibility is "public". Static pages
 * (/, /docs, /xp, /legal/*) are discovered by the module itself.
 *
 * Each half fails soft — a bot or DB outage shrinks the sitemap rather than
 * failing it, since crawlers treat a 5xx sitemap as "try again much later".
 */
import { getRepos } from "../../utils/db";

const PUBLIC_LEADERBOARD_LIMIT = 100;

export default defineSitemapEventHandler(async () => {
  const [docs, leaderboards] = await Promise.all([
    $fetch<{ name: string }[]>("/api/docs/modules")
      .then((modules) =>
        modules.map((m) => ({
          loc: `/docs/${m.name.toLowerCase()}`,
          changefreq: "weekly" as const,
        })),
      )
      .catch(() => []),
    (async () => {
      const repos = getRepos();
      if (!repos) return [];
      try {
        const { servers } = await repos.xp.getPublicServersLeaderboard(
          PUBLIC_LEADERBOARD_LIMIT,
          0,
        );
        return servers.map((s) => ({
          loc: `/xp/${s.guildId}`,
          changefreq: "daily" as const,
        }));
      } catch {
        return [];
      }
    })(),
  ]);

  return [...docs, ...leaderboards];
});
