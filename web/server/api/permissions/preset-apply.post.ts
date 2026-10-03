/**
 * POST /api/permissions/preset-apply  { guild_id, preset_id, slots, channel_ids, plan_hash }
 *
 * Applies a permission preset. The server re-derives the plan from fresh
 * Discord data and refuses (409) unless its hash equals the one the caller
 * previewed. Requires the caller to be a dashboard manager who currently owns
 * or manages the guild in Discord. Records the previous overwrites in the guild
 * logs, including for a partially applied preset.
 */
import { validatePresetRequest } from "#shared/permission-presets";
import { getRepos } from "../../utils/db";
import { auditReportCache } from "../../utils/permission-audit-cache";
import { FixError, fixErrorToHttp } from "../../utils/permission-audit-fix";
import { applyPreset } from "../../utils/permission-audit-preset";
import { requireGuildManager } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown> | null;
  const guildId = String(body?.guild_id ?? "");
  const planHash = String(body?.plan_hash ?? "");
  const parsed = validatePresetRequest(body);
  if (!/^\d{1,25}$/.test(guildId) || !/^[0-9a-f]{64}$/.test(planHash) || !parsed.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.ok
        ? "Missing or invalid guild_id or plan_hash."
        : parsed.error,
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
    const result = await applyPreset(
      {
        botToken,
        get: (url, headers) => $fetch(url, { headers }),
        request: (method, url, headers, reqBody) =>
          $fetch(url, { method, headers, body: reqBody as any }),
        configs: repos.guildConfigs,
        logs: repos.logs,
      },
      { guildId, userId: identity.userId },
      parsed.req,
      planHash,
    );
    auditReportCache.delete(guildId);
    return result;
  } catch (error: any) {
    // A partially applied preset has already changed channels: drop the stale cached report too.
    if (error instanceof FixError && error.applied > 0) auditReportCache.delete(guildId);
    const { statusCode, message } = fixErrorToHttp(error);
    if (statusCode >= 500) {
      console.error(`[Permission Preset API] apply ${guildId} failed:`, error?.message || error);
    }
    throw createError({ statusCode, statusMessage: message });
  }
});
