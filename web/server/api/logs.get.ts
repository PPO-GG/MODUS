/**
 * GET /api/logs?guild_id=...&limit=...
 *
 * Per-guild log tail. The admin dashboard has its own /api/admin/logs
 * for cross-guild scope; this one is scoped so guild-level pages can
 * read without seeing other guilds' logs.
 */
import { getRepos } from "../utils/db";
import { requireGuildManager } from "../utils/session";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const guildId = query.guild_id as string;
  if (!guildId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing guild_id query parameter.",
    });
  }

  // Logs are per-guild operational data — only managers of this guild may
  // read them (any authenticated user previously could, cross-tenant).
  await requireGuildManager(event, guildId);

  const limit = Math.min(Number(query.limit) || 200, 500);

  const repos = getRepos();
  if (!repos) {
    throw createError({
      statusCode: 503,
      statusMessage: "Database unavailable (NUXT_DATABASE_URL not set).",
    });
  }

  try {
    const levels = String(query.level ?? "")
      .split(",")
      .map((l) => l.trim())
      .filter((l): l is "info" | "warn" | "error" => l === "info" || l === "warn" || l === "error");
    const since = query.since ? new Date(String(query.since)) : undefined;
    if (levels.length === 0 && !since) {
      return await repos.logs.listByGuild(guildId, limit);
    }
    return await repos.logs.listByGuildFiltered(guildId, {
      limit,
      levels,
      since: since && !Number.isNaN(since.getTime()) ? since : undefined,
    });
  } catch (error: any) {
    console.error(
      `[Logs API] listByGuild(${guildId}) failed:`,
      error?.message || error,
    );
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to fetch logs.",
    });
  }
});
