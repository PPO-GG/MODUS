/**
 * POST /api/permissions/access-preview  { guild_id, edits: [{ channel_id, rule }] }
 *
 * Returns the exact changes the edited rules would make ({ plan, canApply,
 * blockers, stats }) without changing anything. Requires a dashboard manager
 * who currently owns or manages the guild in Discord.
 */
import { validateAccessRequest } from "#shared/channel-access";
import { getRepos } from "../../utils/db";
import { fixErrorToHttp } from "../../utils/permission-audit-fix";
import { previewAccess } from "../../utils/permission-access";
import { requireGuildManager } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const parsed = validateAccessRequest(await readBody(event));
  if (!parsed.ok) throw createError({ statusCode: 400, statusMessage: parsed.error });
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
    return await previewAccess(
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
    );
  } catch (error: any) {
    const { statusCode, message } = fixErrorToHttp(error);
    if (statusCode >= 500) {
      console.error(`[Channel Access API] preview ${guildId} failed:`, error?.message || error);
    }
    throw createError({ statusCode, statusMessage: message });
  }
});
