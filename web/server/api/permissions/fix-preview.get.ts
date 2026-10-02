/**
 * GET /api/permissions/fix-preview?guild_id=<id>&finding_id=<id>
 *
 * Returns the exact fix the apply route would perform for one audit finding
 * ({ plan, canApply, blockers }) without changing anything. Requires the
 * caller to be a dashboard manager who currently owns or manages the guild in
 * Discord.
 */
import { getRepos } from "../../utils/db";
import { previewFix, fixErrorToHttp } from "../../utils/permission-audit-fix";
import { requireGuildManager } from "../../utils/session";

const FINDING_ID = /^[a-z-]{1,40}(:[\w-]{1,64}){1,2}$/;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const guildId = String(query.guild_id ?? "");
  const findingId = String(query.finding_id ?? "");
  if (!/^\d{1,25}$/.test(guildId) || !FINDING_ID.test(findingId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing or invalid guild_id or finding_id parameter.",
    });
  }

  const identity = await requireGuildManager(event, guildId);

  const botToken = useRuntimeConfig().discordBotToken as string;
  if (!botToken) {
    throw createError({
      statusCode: 500,
      statusMessage: "Bot token not configured on server.",
    });
  }
  const repos = getRepos();
  if (!repos) {
    throw createError({
      statusCode: 503,
      statusMessage: "Database unavailable (NUXT_DATABASE_URL not set).",
    });
  }

  try {
    return await previewFix(
      {
        botToken,
        get: (url, headers) => $fetch(url, { headers }),
        request: (method, url, headers, body) =>
          $fetch(url, { method, headers, body: body as any }),
        configs: repos.guildConfigs,
        logs: repos.logs,
      },
      { guildId, userId: identity.userId, findingId },
    );
  } catch (error: any) {
    const { statusCode, message } = fixErrorToHttp(error);
    if (statusCode >= 500) {
      console.error(`[Permission Fix API] preview ${guildId} failed:`, error?.message || error);
    }
    throw createError({ statusCode, statusMessage: message });
  }
});
