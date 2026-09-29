/**
 * GET /api/moderation/cases?guild_id=...&limit=...&before=...
 *
 * Recent moderation cases plus 7-day per-action counts for the Overview page.
 */
import { getRepos } from "../../utils/db";
import { requireModuleAccess } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const guildId = query.guild_id as string;
  if (!guildId) {
    throw createError({ statusCode: 400, statusMessage: "Missing guild_id query parameter." });
  }
  await requireModuleAccess(event, guildId, "moderation");

  const limit = Math.min(Math.max(Number(query.limit) || 8, 1), 50);
  const before = query.before !== undefined ? Number(query.before) : undefined;
  const repos = getRepos();
  if (!repos) throw createError({ statusCode: 503, statusMessage: "Database unavailable." });

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [cases, counts7d] = await Promise.all([
    repos.moderationCases.listRecent(guildId, { limit, before: Number.isFinite(before) ? before : undefined }),
    repos.moderationCases.countsSince(guildId, since),
  ]);
  return { cases, counts7d };
});
