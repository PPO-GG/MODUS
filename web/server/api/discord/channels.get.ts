/**
 * Server-side endpoint to fetch text channels for a given guild.
 * Uses the bot token to access guild channels directly.
 *
 * Query params:
 *   - guild_id: The Discord guild ID
 *   - types: Optional comma-separated kinds to return: text (default), voice, category
 */
import { getAccessibleModules } from "../../utils/session";

const CHANNEL_TYPE_GROUPS: Record<string, number[]> = {
  text: [0, 5], // GUILD_TEXT, GUILD_ANNOUNCEMENT
  voice: [2], // GUILD_VOICE
  category: [4], // GUILD_CATEGORY
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const query = getQuery(event);
  const guildId = query.guild_id as string;

  if (!guildId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing guild_id parameter.",
    });
  }

  const accessibleModules = await getAccessibleModules(event, guildId);
  if (accessibleModules !== "all" && accessibleModules.length === 0) {
    throw createError({
      statusCode: 403,
      statusMessage: "You don't manage this server.",
    });
  }

  const botToken = config.discordBotToken as string;
  if (!botToken) {
    throw createError({
      statusCode: 500,
      statusMessage: "Bot token not configured on server.",
    });
  }

  try {
    const channels: any[] = await $fetch(
      `https://discord.com/api/v10/guilds/${guildId}/channels`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      },
    );

    // Text-based channels by default; callers opt in to other kinds via `types`
    const requested = String(query.types ?? "text")
      .split(",")
      .map((t) => t.trim());
    const allowedTypes = requested.flatMap((t) => CHANNEL_TYPE_GROUPS[t] ?? []);

    const textChannels = channels
      .filter((c) => allowedTypes.includes(c.type))
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        position: c.position,
        parentId: c.parent_id || null,
      }));

    // Also get category channels for grouping
    const categories = channels
      .filter((c) => c.type === 4) // 4 = GUILD_CATEGORY
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        name: c.name,
        position: c.position,
      }));

    return {
      channels: textChannels,
      categories,
    };
  } catch (error: any) {
    console.error(
      `[Channels API] Error fetching channels for guild ${guildId}:`,
      error?.message || error,
    );
    throw createError({
      statusCode: error?.status || error?.statusCode || 500,
      statusMessage:
        error?.message ||
        "Failed to fetch channels. Is the bot in this server?",
    });
  }
});
