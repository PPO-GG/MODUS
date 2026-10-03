/**
 * Top starred posts and top authors for one board.
 *
 * Query: guild_id, board_id.
 */
import { getRepos } from "../../utils/db";
import { requireModuleAccess } from "../../utils/session";
import { fetchGuildMemberIdentities } from "../../utils/discord";

const LIMIT = 10;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const guildId = query.guild_id as string;
  const boardId = query.board_id as string;

  if (!guildId || !boardId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing guild_id or board_id query parameter.",
    });
  }

  await requireModuleAccess(event, guildId, "starboard");

  const repos = getRepos();
  if (!repos) {
    throw createError({
      statusCode: 503,
      statusMessage: "Database unavailable (NUXT_DATABASE_URL not set).",
    });
  }

  const [posts, authors] = await Promise.all([
    repos.starboardPosts.topPosts(guildId, boardId, LIMIT),
    repos.starboardPosts.topAuthors(guildId, boardId, LIMIT),
  ]);

  const identities = await fetchGuildMemberIdentities(guildId, [
    ...posts.map((p) => p.authorId),
    ...authors.map((a) => a.authorId),
  ]);
  const nameOf = (id: string) => identities.get(id)?.displayName ?? id;

  return {
    posts: posts.map((p) => ({
      id: p.id,
      sourceChannelId: p.sourceChannelId,
      sourceMessageId: p.sourceMessageId,
      boardMessageId: p.boardMessageId,
      authorId: p.authorId,
      authorName: nameOf(p.authorId),
      starCount: p.starCount,
      createdAt: p.createdAt,
    })),
    authors: authors.map((a) => ({ ...a, authorName: nameOf(a.authorId) })),
  };
});
