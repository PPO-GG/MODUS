/**
 * GET /api/tickets/open?guild_id=...
 *
 * Open tickets with a Discord jump URL for the Overview page.
 */
import { getRepos } from "../../utils/db";
import { requireModuleAccess } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const guildId = query.guild_id as string;
  if (!guildId) {
    throw createError({ statusCode: 400, statusMessage: "Missing guild_id query parameter." });
  }
  await requireModuleAccess(event, guildId, "tickets");

  const repos = getRepos();
  if (!repos) throw createError({ statusCode: 503, statusMessage: "Database unavailable." });

  const rows = await repos.tickets.listOpen(guildId);
  return {
    tickets: rows.map((t) => ({ ...t, url: `https://discord.com/channels/${guildId}/${t.threadId}` })),
  };
});
