/**
 * Roles and text channels for the AI rule-draft prompt and validator. Uses the
 * same Discord endpoints and filters as api/discord/roles.get.ts and
 * channels.get.ts, but returns only { id, name } and takes the HTTP client as a
 * parameter so it can be tested without Nitro.
 */
import type { GuildContext } from "@modus/db/automod-rules";

export type DiscordGet = (
  url: string,
  headers: Record<string, string>,
) => Promise<unknown>;

export const GUILD_CONTEXT_LIMIT = 100;

const asArray = (value: unknown): Record<string, any>[] =>
  Array.isArray(value) ? (value as Record<string, any>[]) : [];

export async function fetchGuildContext(
  guildId: string,
  botToken: string,
  get: DiscordGet,
): Promise<GuildContext> {
  if (!/^\d{1,25}$/.test(guildId)) throw new Error("Invalid guild id.");

  const headers = { Authorization: `Bot ${botToken}` };
  const base = `https://discord.com/api/v10/guilds/${guildId}`;
  const [rawRoles, rawChannels] = await Promise.all([
    get(`${base}/roles`, headers),
    get(`${base}/channels`, headers),
  ]);

  const roles = asArray(rawRoles)
    .filter((r) => r.id !== guildId && !r.managed)
    .sort((a, b) => (b.position ?? 0) - (a.position ?? 0))
    .slice(0, GUILD_CONTEXT_LIMIT)
    .map((r) => ({ id: String(r.id), name: String(r.name ?? "") }));

  const channels = asArray(rawChannels)
    // Plain text channels only: the bot's channel actions do `instanceof TextChannel`,
    // which announcement channels (type 5) fail, so a rule pointing at one never fires.
    .filter((c) => c.type === 0)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .slice(0, GUILD_CONTEXT_LIMIT)
    .map((c) => ({ id: String(c.id), name: String(c.name ?? "") }));

  return { roles, channels };
}
