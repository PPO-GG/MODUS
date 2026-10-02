/**
 * Server-side endpoint to fetch roles for a given guild.
 * Uses the bot token to access guild roles directly.
 *
 * Query params:
 *   - guild_id: The Discord guild ID
 */
import { getAccessibleModules } from "../../utils/session";

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
    const roles: any[] = await $fetch(
      `https://discord.com/api/v10/guilds/${guildId}/roles`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
        },
      },
    );

    // Sort by position (highest first), exclude @everyone (position 0),
    // and exclude managed roles (bot roles, integration roles, etc.)
    const filteredRoles = roles
      .filter((r) => r.id !== guildId) // @everyone role has the same ID as the guild
      .sort((a, b) => b.position - a.position)
      .map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        position: r.position,
        managed: r.managed,
        permissions: r.permissions,
      }));

    // Hierarchy: the bot can only grant roles below its own highest role. The
    // bot's user id is the application (client) id. Any failure -> null, so the
    // dashboard shows no hierarchy warning rather than a false one.
    let botTopPosition: number | null = null;
    const botUserId = config.public.discordClientId as string;
    if (botUserId) {
      try {
        const botMember: { roles: string[] } = await $fetch(
          `https://discord.com/api/v10/guilds/${guildId}/members/${botUserId}`,
          { headers: { Authorization: `Bot ${botToken}` } },
        );
        const held = roles.filter((r) => botMember.roles.includes(r.id));
        // A member with no roles sits at @everyone (position 0).
        botTopPosition = held.reduce((max, r) => Math.max(max, r.position), 0);
      } catch (error: any) {
        console.warn(
          `[Roles API] Could not resolve the bot's top role for guild ${guildId}:`,
          error?.message || error,
        );
      }
    }

    return {
      roles: filteredRoles,
      botTopPosition,
    };
  } catch (error: any) {
    console.error(
      `[Roles API] Error fetching roles for guild ${guildId}:`,
      error?.message || error,
    );
    throw createError({
      statusCode: error?.status || error?.statusCode || 500,
      statusMessage:
        error?.message || "Failed to fetch roles. Is the bot in this server?",
    });
  }
});
