/**
 * GET /api/welcome/preview/:guild_id
 *
 * Renders the guild's saved welcome image for the signed-in dashboard user,
 * so the welcome overview page can show what a new member would receive.
 *
 * Auth: welcome module access. The avatar URL is derived from the sealed
 * session — never from the request — because the renderer fetches it.
 *
 * Response: PNG image buffer (Content-Type: image/png)
 */
import { renderGuildWelcomeImage } from "../../../utils/welcome-render";
import { requireModuleAccess } from "../../../utils/session";
import { getRepos } from "../../../utils/db";

function discordAvatarUrl(user: { id: string; avatar: string | null }): string {
  if (user.avatar) {
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
  }
  // Default avatars for users on the new username system are indexed by id.
  const index = Number((BigInt(user.id) >> BigInt(22)) % BigInt(6));
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export default defineEventHandler(async (event) => {
  const guildId = getRouterParam(event, "guild_id");
  if (!guildId) {
    throw createError({ statusCode: 400, statusMessage: "Missing guild_id." });
  }

  await requireModuleAccess(event, guildId, "welcome");
  const { user } = await getUserSession(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  // Server name and member count are only drawn as text; a missing row just
  // renders blanks rather than failing the preview.
  const server = await getRepos()
    ?.servers.getByGuildId(guildId)
    .catch(() => null);
  const serverName = server?.name ?? "";
  const memberCount = server?.member_count ?? 0;

  try {
    const imageBuffer = await renderGuildWelcomeImage({
      guildId,
      avatarUrl: discordAvatarUrl(user),
      username: user.username,
      displayName: user.globalName || user.username,
      tag: user.username,
      serverName,
      memberCount,
    });

    setResponseHeader(event, "Content-Type", "image/png");
    setResponseHeader(event, "Content-Length", imageBuffer.length);
    setResponseHeader(event, "Cache-Control", "no-store");
    return imageBuffer;
  } catch (err) {
    console.error("[Welcome Preview] Render failed:", err);
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to render welcome preview",
    });
  }
});
