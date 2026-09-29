/**
 * GET /api/servers/[guild_id]/summary
 *
 * Member/XP headline stats and top-3 for the Overview page.
 */
import { getRepos } from "../../../utils/db";
import { getXpProgress } from "@modus/db/rank-cards";
import { getAccessibleModules } from "../../../utils/session";

export default defineEventHandler(async (event) => {
  const guildId = getRouterParam(event, "guild_id");
  if (!guildId) throw createError({ statusCode: 400, statusMessage: "Missing guild id." });

  const access = await getAccessibleModules(event, guildId);
  if (access !== "all" && access.length === 0) {
    throw createError({ statusCode: 403, statusMessage: "No access to this server." });
  }

  const repos = getRepos();
  if (!repos) throw createError({ statusCode: 503, statusMessage: "Database unavailable." });

  const [server, stats, top] = await Promise.all([
    repos.servers.getByGuildId(guildId),
    repos.xp.getGuildStats(guildId),
    repos.xp.getTopUsers(guildId, 3, true),
  ]);

  return {
    memberCount: server?.member_count ?? 0,
    trackedMembers: stats.totalUsers,
    totalMessages: stats.totalMessages,
    top3: top.map((u) => ({
      userId: u.user_id,
      username: u.username ?? null,
      avatar: u.avatar ?? null,
      level: getXpProgress(u.xp).level,
      xp: u.xp,
    })),
  };
});
