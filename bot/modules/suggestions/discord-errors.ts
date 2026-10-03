/** Discord REST error code: Unknown Channel. */
const UNKNOWN_CHANNEL = 10003;
/** discord.js error code thrown by `GuildChannelManager.fetch` for a channel of another guild. */
const GUILD_CHANNEL_UNOWNED = "GuildChannelUnowned";

/**
 * True only for DEFINITE non-membership: the channel does not exist, or it
 * belongs to a different guild. Transient failures (5xx, network resets,
 * timeouts) and permission errors (50001) are false, so callers never treat
 * them as "the channel is gone" and never make irreversible decisions on them.
 */
export function isChannelNotInGuild(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === UNKNOWN_CHANNEL || code === GUILD_CHANNEL_UNOWNED;
}

/**
 * True for routine interaction-lifecycle failures: Unknown interaction (10062,
 * the token expired, e.g. fast autocomplete typing) and Interaction already
 * acknowledged (40060). ModuleManager deliberately keeps these quiet.
 */
export function isStaleInteractionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === 10062 || code === 40060;
}
