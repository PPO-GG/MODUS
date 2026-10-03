/**
 * Review a suggestion from the dashboard. Mirrors the bot's applyReview:
 * write the status, re-render the embed with live vote counts, and leave a
 * note in the discussion thread. The Discord edits go straight to the REST
 * API with the bot token (same approach as ../giveaways/update.post.ts).
 *
 * Body: { guild_id, id, status, reason? }
 */
import { getRepos } from "../../utils/db";
import { requireModuleAccess } from "../../utils/session";
import { parseReviewBody } from "../../utils/suggestions";
import { buildSuggestionMessage, isVotingLocked, STATUS_META } from "./_embed";
import type { SuggestionStatus } from "./_embed";

const DISCORD_API = "https://discord.com/api/v10";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const parsed = parseReviewBody(await readBody(event));
  if (!parsed.ok) {
    throw createError({ statusCode: 400, statusMessage: parsed.message });
  }
  const { guildId, id, status, reason } = parsed.value;

  const identity = await requireModuleAccess(event, guildId, "suggestions");

  const repos = getRepos();
  if (!repos) {
    throw createError({
      statusCode: 503,
      statusMessage: "Database unavailable (NUXT_DATABASE_URL not set).",
    });
  }

  // Guild scoping: only a suggestion belonging to the authorized guild is ever touched,
  // and every Discord URL below is built from ids stored on this checked row.
  const suggestion = await repos.suggestions.getById(id);
  if (!suggestion || suggestion.guildId !== guildId) {
    throw createError({ statusCode: 404, statusMessage: "Suggestion not found for this server." });
  }
  if (suggestion.status === "withdrawn") {
    throw createError({
      statusCode: 400,
      statusMessage: "A withdrawn suggestion can't be reviewed.",
    });
  }

  const botToken = config.discordBotToken as string;
  if (!botToken) {
    throw createError({ statusCode: 500, statusMessage: "Bot token not configured on server." });
  }

  const settings = await repos.guildConfigs.getModuleSettings(guildId, "suggestions");
  const closeVotingOnDecision = settings.closeVotingOnDecision !== false;

  const updated = await repos.suggestions.setStatus(id, { status, reason, reviewedBy: identity.userId });
  if (!updated) {
    // Withdrawn (or removed) between the read above and the write; never resurrect it.
    throw createError({
      statusCode: 400,
      statusMessage: "A withdrawn suggestion can't be reviewed.",
    });
  }
  const tally = await repos.suggestionVotes.tally(id);

  let embedUpdated = false;
  let withdrawn = false;
  if (updated.channelId && updated.messageId) {
    const payload = buildSuggestionMessage({
      id: updated.id,
      number: updated.number,
      title: updated.title,
      body: updated.body,
      authorId: updated.authorId,
      status: updated.status as SuggestionStatus,
      statusReason: updated.statusReason,
      reviewedBy: updated.reviewedBy,
      up: tally.up,
      down: tally.down,
      votingLocked: isVotingLocked(updated.status as SuggestionStatus, closeVotingOnDecision),
      createdAtMs: updated.createdAt.getTime(),
    });
    try {
      // PATCH carries embeds + components only (no `content`).
      await $fetch(`${DISCORD_API}/channels/${updated.channelId}/messages/${updated.messageId}`, {
        method: "PATCH",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: payload,
      });
      embedUpdated = true;
    } catch (error: any) {
      const code = error?.data?.code ?? error?.response?._data?.code;
      if (code === 10008 || error?.status === 404 || error?.statusCode === 404) {
        await repos.suggestions.markWithdrawn(id);
        withdrawn = true;
      } else {
        console.error(
          "[Suggestions Review API] Discord rejected the edit:",
          JSON.stringify(error?.data || error?.response?._data, null, 2),
        );
      }
    }
  }

  if (updated.threadId) {
    const label = STATUS_META[status].label;
    const note =
      `Marked **${label}** by <@${identity.userId}>` + (reason ? `: ${reason}` : "");
    try {
      // `reason` is user-controlled text: never let it ping anyone.
      await $fetch(`${DISCORD_API}/channels/${updated.threadId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: { content: note, allowed_mentions: { parse: [] } },
      });
    } catch {
      // Archived/locked/deleted thread — never fail the review over a courtesy note.
    }
  }

  return {
    ok: true,
    embedUpdated,
    withdrawn,
    suggestion: {
      id: updated.id,
      number: updated.number,
      status: withdrawn ? "withdrawn" : updated.status,
      statusReason: updated.statusReason,
      reviewedBy: updated.reviewedBy,
      up: tally.up,
      down: tally.down,
    },
  };
});
