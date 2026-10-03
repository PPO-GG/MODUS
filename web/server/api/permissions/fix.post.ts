/**
 * POST /api/permissions/fix  { guild_id, finding_id, plan_hash }
 *
 * Applies the fix for one audit finding. The server re-derives the plan from
 * fresh Discord data and refuses (409) unless its hash equals the one the
 * caller previewed. Requires the caller to be a dashboard manager who
 * currently owns or manages the guild in Discord. Records the previous
 * overwrites in the guild logs.
 */
import { getRepos } from "../../utils/db";
import { auditReportCache } from "../../utils/permission-audit-cache";
import { applyFix, fixErrorToHttp } from "../../utils/permission-audit-fix";
import { requireGuildManager } from "../../utils/session";

const FINDING_ID = /^[a-z-]{1,40}(:[\w-]{1,64}){1,2}$/;

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown> | null;
  const guildId = String(body?.guild_id ?? "");
  const findingId = String(body?.finding_id ?? "");
  const planHash = String(body?.plan_hash ?? "");
  if (
    !/^\d{1,25}$/.test(guildId) ||
    !FINDING_ID.test(findingId) ||
    !/^[0-9a-f]{64}$/.test(planHash)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing or invalid guild_id, finding_id or plan_hash.",
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
    const result = await applyFix(
      {
        botToken,
        get: (url, headers) => $fetch(url, { headers }),
        request: (method, url, headers, reqBody) =>
          $fetch(url, { method, headers, body: reqBody as any }),
        configs: repos.guildConfigs,
        logs: repos.logs,
      },
      { guildId, userId: identity.userId, findingId },
      planHash,
    );
    auditReportCache.delete(guildId);
    return result;
  } catch (error: any) {
    const { statusCode, message } = fixErrorToHttp(error);
    if (statusCode >= 500) {
      console.error(`[Permission Fix API] apply ${guildId} failed:`, error?.message || error);
    }
    throw createError({ statusCode, statusMessage: message });
  }
});
