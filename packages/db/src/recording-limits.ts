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

/**
 * Session limits are fixed per tier and set by the bot operator — server
 * admins can't change them. Premium only changes how long a session may run
 * and unlocks per-user multitrack; the user cap is the same for everyone.
 */
export const MAX_RECORDING_USERS = 5;
export const FREE_MAX_RECORDING_SECONDS = 60 * 60;
export const PREMIUM_MAX_RECORDING_SECONDS = 4 * 60 * 60;

export interface RecordingLimits {
  /** Hard stop for a single recording session, in seconds. */
  maxDurationSeconds: number;
  /** Users (and, in multitrack, tracks) recorded at once. */
  maxUsers: number;
}

export function getRecordingLimits(premium: boolean): RecordingLimits {
  return {
    maxDurationSeconds: premium
      ? PREMIUM_MAX_RECORDING_SECONDS
      : FREE_MAX_RECORDING_SECONDS,
    maxUsers: MAX_RECORDING_USERS,
  };
}
