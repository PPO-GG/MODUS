/**
 * GET /api/permissions/audit?guild_id=<id>[&fresh=1]
 *
 * Read-only permission audit for one guild: dangerous @everyone permissions,
 * role hierarchy, channel overwrite exposure, and whether the bot has what
 * each configured module needs. Reads Discord with the bot token, so it is
 * restricted to managers of the guild. Results are cached 30s per guild;
 * `fresh=1` (the dashboard's Re-run button) bypasses the cache.
 */
import type { Report } from "#shared/permission-audit-types";
import { getRepos } from "../../utils/db";
import { describeUpstreamFailure } from "../../utils/discord-upstream-error";
import { runPermissionAudit } from "../../utils/permission-audit";
import {
  BotNotInGuildError,
  createTtlCache,
  loadAuditInput,
} from "../../utils/permission-audit-data";
import { requireGuildManager } from "../../utils/session";

const cache = createTtlCache<Report>(30_000);

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const guildId = String(query.guild_id ?? "");
  if (!/^\d{1,25}$/.test(guildId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing or invalid guild_id parameter.",
    });
  }

  await requireGuildManager(event, guildId);

  if (query.fresh !== "1") {
    const cached = cache.get(guildId);
    if (cached) return cached;
  }

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
    const input = await loadAuditInput(
      guildId,
      botToken,
      (url, headers) => $fetch(url, { headers }),
      repos.guildConfigs,
    );
    const report = runPermissionAudit(input);
    cache.set(guildId, report);
    return report;
  } catch (error: any) {
    if (error instanceof BotNotInGuildError) {
      throw createError({
        statusCode: 404,
        statusMessage:
          "MODUS can't access this server. Make sure the bot is in the server.",
      });
    }
    const failure = describeUpstreamFailure(error);
    console.error(`[Permission Audit API] guild ${guildId} failed:`, failure);
    if (failure.status === 429) {
      throw createError({
        statusCode: 429,
        statusMessage: "Discord is rate limiting requests. Try again shortly.",
      });
    }
    throw createError({
      statusCode: 502,
      statusMessage: "Failed to read permissions from Discord.",
    });
  }
});
