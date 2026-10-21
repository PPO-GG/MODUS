/**
 * Turns Discord's "bot can't see / write to this channel" errors into one
 * actionable warning and one notice to the server owner per day, instead of an
 * error on every event. State is in-process: a guild lives on one shard, and a
 * restart at worst repeats a notice.
 */
import type { Guild } from "discord.js";
import type { Logger } from "../Logger";

export const ACCESS_NOTICE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const PUBLIC_URL = (
  process.env.PUBLIC_WEB_URL ||
  process.env.DASHBOARD_URL ||
  "https://modusbot.io"
).replace(/\/$/, "");

/** When each (guild, channel, module) was last warned about / each guild's owner last DMed. */
const warnedAt = new Map<string, number>();
const dmedAt = new Map<string, number>();

export interface AccessErrorContext {
  guild: Guild;
  channelId?: string;
  /** Module name, e.g. "logging". */
  module: string;
  /** What failed, as a phrase: "send audit logs". */
  feature: string;
  logger: Logger;
}

/** Dashboard page where an admin can fix the bot's permissions in one click. */
export function permissionsUrl(guildId: string): string {
  return `${PUBLIC_URL}/dashboard/server/${guildId}/permissions`;
}

/** True for Discord's Missing Access (50001) and Missing Permissions (50013). */
export function isDiscordAccessError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return code === 50001 || code === 50013;
}

/** Best-effort DM to the guild owner. Returns false when it could not be delivered. */
export async function dmGuildOwner(guild: Guild, text: string): Promise<boolean> {
  try {
    const owner = await guild.fetchOwner();
    await owner.send(text);
    return true;
  } catch {
    // DMs closed, owner left, or Discord refused: nothing more we can do.
    return false;
  }
}

/**
 * Handles an access error for a failed channel send. Returns true when `err`
 * was an access error (handled: the caller should not log it as an error).
 */
export async function reportAccessError(
  err: unknown,
  ctx: AccessErrorContext,
  now: number = Date.now(),
): Promise<boolean> {
  if (!isDiscordAccessError(err)) return false;
  const { guild, channelId, module, feature, logger } = ctx;

  const key = `${guild.id}:${channelId ?? ""}:${module}`;
  const warned = warnedAt.get(key);
  if (warned !== undefined && now - warned < ACCESS_NOTICE_COOLDOWN_MS) return true;
  warnedAt.set(key, now);

  const channel = channelId ? guild.channels.cache.get(channelId) : undefined;
  const where = channel && "name" in channel ? `#${channel.name}` : "a configured channel";
  logger.warn(
    `Cannot ${feature} in ${where}: the bot lacks access there. Fix: ${permissionsUrl(guild.id)}`,
    guild.id,
    module,
  );

  const dmed = dmedAt.get(guild.id);
  if (dmed === undefined || now - dmed >= ACCESS_NOTICE_COOLDOWN_MS) {
    const sent = await dmGuildOwner(
      guild,
      `MODUS couldn't ${feature} in ${where} in **${guild.name}** because it doesn't have access to that channel. ` +
        `You can fix this in one click on the dashboard: ${permissionsUrl(guild.id)}`,
    );
    if (sent) dmedAt.set(guild.id, now);
  }
  return true;
}

/** Test hook. */
export function resetAccessNotices(): void {
  warnedAt.clear();
  dmedAt.clear();
}
