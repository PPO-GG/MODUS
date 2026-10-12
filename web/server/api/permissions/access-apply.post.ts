/**
 * POST /api/permissions/access-apply  { guild_id, edits, plan_hash }
 *
 * Applies the previewed channel access edits. The server re-derives the plan
 * from fresh Discord data and refuses (409) unless its hash equals the one the
 * caller previewed. Records the previous overwrites in the guild logs,
 * including for a partially applied plan.
 */
import { validateAccessRequest } from "#shared/channel-access";
import { getRepos } from "../../utils/db";
import { auditReportCache } from "../../utils/permission-audit-cache";
import { FixError, fixErrorToHttp } from "../../utils/permission-audit-fix";
import { applyAccess } from "../../utils/permission-access";
import { requireGuildManager } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown> | null;
  const planHash = String(body?.plan_hash ?? "");
  const parsed = validateAccessRequest(body);
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.error });
  if (!/^[0-9a-f]{64}$/.test(planHash)) {
    throw createError({ statusCode: 400, statusMessage: "Missing or invalid plan_hash." });
  }
  const { guildId, edits } = parsed;

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
    const result = await applyAccess(
      {
        botToken,
        get: (url, headers) => $fetch(url, { headers }),
        request: (method, url, headers, reqBody) =>
          $fetch(url, { method, headers, body: reqBody as any }),
        configs: repos.guildConfigs,
        logs: repos.logs,
      },
      { guildId, userId: identity.userId },
      edits,
      planHash,
    );
    auditReportCache.delete(guildId);
    return result;
  } catch (error: any) {
    // A partially applied plan has already changed channels: drop the stale cached report too.
    if (error instanceof FixError && error.applied > 0) auditReportCache.delete(guildId);
    const { statusCode, message } = fixErrorToHttp(error);
    if (statusCode >= 500) {
      console.error(`[Channel Access API] apply ${guildId} failed:`, error?.message || error);
    }
    throw createError({ statusCode, statusMessage: message });
  }
});
