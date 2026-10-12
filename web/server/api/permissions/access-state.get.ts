/**
 * GET /api/permissions/access-state?guild_id=...
 *
 * The Channel Access editor's snapshot: roles, the bot's position and roles,
 * and every channel with its classified rule, badges, member override count
 * and whether it is synced with its category. Requires a dashboard manager who
 * currently owns or manages the guild in Discord.
 */
import { getRepos } from "../../utils/db";
import { fixErrorToHttp } from "../../utils/permission-audit-fix";
import { loadAccessState } from "../../utils/permission-access";
import { requireGuildManager } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const guildId = String(getQuery(event).guild_id ?? "");
  if (!/^\d{1,25}$/.test(guildId)) {
    throw createError({ statusCode: 400, statusMessage: "Missing or invalid guild_id." });
  }

  const identity = await requireGuildManager(event, guildId);

  const botToken = useRuntimeConfig().discordBotToken as string;
  if (!botToken) {
    throw createError({ statusCode: 500, statusMessage: "Bot token not configured on server." });
  }
  const repos = getRepos();
  if (!repos) {
    throw createError({ statusCode: 503, statusMessage: "Database unavailable (NUXT_DATABASE_URL not set)." });
  }

  try {
    return await loadAccessState(
      {
        botToken,
        get: (url, headers) => $fetch(url, { headers }),
        request: (method, url, headers, reqBody) =>
          $fetch(url, { method, headers, body: reqBody as any }),
        configs: repos.guildConfigs,
        logs: repos.logs,
      },
      { guildId, userId: identity.userId },
    );
  } catch (error: any) {
    const { statusCode, message } = fixErrorToHttp(error);
    if (statusCode >= 500) {
      console.error(`[Channel Access API] state ${guildId} failed:`, error?.message || error);
    }
    throw createError({ statusCode, statusMessage: message });
  }
});
