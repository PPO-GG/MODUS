/**
 * Recording quality tiers shared by the bot, the settings API, and the
 * dashboard so the premium boundary is defined in exactly one place.
 */

/** Highest bitrate (kbps) available to non-premium guilds. */
export const FREE_MAX_RECORDING_BITRATE = 64;

export const RECORDING_BITRATES = [32, 64, 128, 256] as const;

export const MIN_RECORDING_BITRATE = RECORDING_BITRATES[0];
export const MAX_RECORDING_BITRATE =
  RECORDING_BITRATES[RECORDING_BITRATES.length - 1];

export function isPremiumRecordingBitrate(bitrate: number): boolean {
  return bitrate > FREE_MAX_RECORDING_BITRATE;
}

/**
 * Returns the bitrate a guild is actually allowed to record at. Premium
 * guilds keep the requested value; free guilds are capped at the free tier.
 */
export function clampRecordingBitrate(
  bitrate: number,
  premium: boolean,
): number {
  return premium ? bitrate : Math.min(bitrate, FREE_MAX_RECORDING_BITRATE);
}
