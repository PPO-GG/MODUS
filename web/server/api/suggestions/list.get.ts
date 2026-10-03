/**
 * Review queue for a guild's suggestions, newest first, with live vote
 * tallies. `voters_for=<suggestion id>` is a separate lookup: it returns only
 * that suggestion's voters (first 100, with `votersTotal` the full count) and
 * skips the list query and author resolution.
 *
 * Query: guild_id, status?, before? (ISO date cursor), limit? (1–50, default 25), voters_for?
 */
import { getRepos } from "../../utils/db";
import { requireModuleAccess } from "../../utils/session";
import { fetchGuildMemberIdentities } from "../../utils/discord";

const STATUSES = ["pending", "considering", "approved", "denied", "implemented", "withdrawn"] as const;
type Status = (typeof STATUSES)[number];

/** Most voters returned (and name-resolved) for one suggestion. */
const VOTERS_CAP = 100;

/** A query param as a string, or undefined when absent. Repeated params (arrays) are invalid input. */
function singleParam(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw createError({ statusCode: 400, statusMessage: `${name} must be a single value.` });
  }
  return value;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const guildId = singleParam(query.guild_id, "guild_id");
  if (!guildId) {
    throw createError({ statusCode: 400, statusMessage: "Missing guild_id query parameter." });
  }
  const statusParam = singleParam(query.status, "status") ?? "";
  const beforeParam = singleParam(query.before, "before") ?? "";
  const limitParam = singleParam(query.limit, "limit") ?? "25";
  const votersFor = singleParam(query.voters_for, "voters_for") ?? "";

  await requireModuleAccess(event, guildId, "suggestions");

  const repos = getRepos();
  if (!repos) {
    throw createError({
      statusCode: 503,
      statusMessage: "Database unavailable (NUXT_DATABASE_URL not set).",
    });
  }

  if (statusParam && !(STATUSES as readonly string[]).includes(statusParam)) {
    throw createError({ statusCode: 400, statusMessage: "Unknown status filter." });
  }
  const status = (statusParam || undefined) as Status | undefined;

  let before: Date | undefined;
  if (beforeParam) {
    before = new Date(beforeParam);
    if (Number.isNaN(before.getTime())) {
      throw createError({ statusCode: 400, statusMessage: "before must be an ISO date." });
    }
  }

  // Voter lookups for an opened row never list suggestions or resolve their authors,
  // and resolve at most VOTERS_CAP members on the shared bot token.
  if (votersFor) {
    const target = await repos.suggestions.getById(votersFor);
    const voterRows =
      target && target.guildId === guildId ? await repos.suggestionVotes.listVoters(votersFor) : [];
    const shown = voterRows.slice(0, VOTERS_CAP);
    const identities = await fetchGuildMemberIdentities(
      guildId,
      shown.map((v) => v.userId),
    );
    return {
      suggestions: [],
      nextBefore: null,
      voters: shown.map((v) => ({
        userId: v.userId,
        displayName: identities.get(v.userId)?.displayName ?? v.userId,
        direction: v.direction,
      })),
      votersTotal: voterRows.length,
    };
  }

  const limit = Math.min(Math.max(Number.parseInt(limitParam, 10) || 25, 1), 50);

  const rows = await repos.suggestions.list(guildId, { status, limit, before });
  const tallies = await repos.suggestionVotes.tallies(rows.map((r) => r.id));

  const identities = await fetchGuildMemberIdentities(
    guildId,
    rows.map((r) => r.authorId),
  );
  const nameOf = (id: string) => identities.get(id)?.displayName ?? id;

  return {
    suggestions: rows.map((r) => ({
      id: r.id,
      number: r.number,
      title: r.title,
      body: r.body,
      authorId: r.authorId,
      authorName: nameOf(r.authorId),
      status: r.status,
      statusReason: r.statusReason,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      channelId: r.channelId,
      messageId: r.messageId,
      threadId: r.threadId,
      createdAt: r.createdAt,
      up: tallies.get(r.id)?.up ?? 0,
      down: tallies.get(r.id)?.down ?? 0,
    })),
    nextBefore: rows.length === limit ? rows[rows.length - 1]!.createdAt.toISOString() : null,
    voters: null,
    votersTotal: 0,
  };
});
