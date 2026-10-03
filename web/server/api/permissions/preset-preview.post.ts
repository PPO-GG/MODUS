/**
 * POST /api/permissions/preset-preview  { guild_id, preset_id, slots, channel_ids }
 *
 * Returns the exact changes applying a permission preset would make
 * ({ plan, canApply, blockers, stats }) without changing anything. Requires the
 * caller to be a dashboard manager who currently owns or manages the guild in
 * Discord.
 */
import { validatePresetRequest } from "#shared/permission-presets";
import { getRepos } from "../../utils/db";
import { fixErrorToHttp } from "../../utils/permission-audit-fix";
import { previewPreset } from "../../utils/permission-audit-preset";
import { requireGuildManager } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Record<string, unknown> | null;
  const guildId = String(body?.guild_id ?? "");
  const parsed = validatePresetRequest(body);
  if (!/^\d{1,25}$/.test(guildId) || !parsed.ok) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.ok ? "Missing or invalid guild_id." : parsed.error,
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
    return await previewPreset(
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
    );
  } catch (error: any) {
    const { statusCode, message } = fixErrorToHttp(error);
    if (statusCode >= 500) {
      console.error(`[Permission Preset API] preview ${guildId} failed:`, error?.message || error);
    }
    throw createError({ statusCode, statusMessage: message });
  }
});
