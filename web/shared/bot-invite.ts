/**
 * The permissions MODUS requests when it is invited, so servers do not have
 * to give the bot Administrator. Listed explicitly so the consent screen and
 * code review show exactly what is asked for; bot-invite.test.ts fails if a
 * module in module-requirements.ts needs something this list omits.
 * Isomorphic — no side effects.
 */
import { PERMISSION_BITS, type PermissionName } from './discord-permissions'

/** Baseline: reading and posting messages, embeds and files in channels. */
export const INVITE_BASELINE_NAMES: PermissionName[] = [
  'ViewChannel',
  'SendMessages',
  'SendMessagesInThreads',
  'EmbedLinks',
  'AttachFiles',
  'ReadMessageHistory',
  'AddReactions',
  'UseExternalEmojis',
]

export const INVITE_PERMISSION_NAMES: PermissionName[] = [
  ...INVITE_BASELINE_NAMES,
  // Moderation, automod, anti-raid.
  'ManageMessages',
  'KickMembers',
  'BanMembers',
  'ModerateMembers',
  'ViewAuditLog',
  // Roles and channels (auto roles, button roles, verification, lock/lockdown,
  // temp voice).
  'ManageRoles',
  'ManageChannels',
  // Tickets (private threads) and polls.
  'CreatePrivateThreads',
  'ManageThreads',
  // Permission presets can let staff roles create public threads in read-only channels,
  // and a bot can only grant permissions it holds itself.
  'CreatePublicThreads',
  'PinMessages',
  'SendPolls',
  // Events.
  'ManageEvents',
  // Voice: music, recording, temp voice.
  'Connect',
  'Speak',
  'MoveMembers',
  'MuteMembers',
  'DeafenMembers',
  'ChangeNickname',
]

/** Decimal permission bitfield for the OAuth invite URL. */
export function getInvitePermissionBits(): string {
  return INVITE_PERMISSION_NAMES.reduce(
    (acc, name) => acc | PERMISSION_BITS[name],
    BigInt(0),
  ).toString()
}

/** Discord OAuth2 bot invite URL; pass `guildId` to pre-select and lock a server. */
export function buildBotInviteUrl(
  clientId: string,
  options: { guildId?: string } = {},
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'bot applications.commands',
    permissions: getInvitePermissionBits(),
  })
  if (options.guildId) {
    params.set('guild_id', options.guildId)
    params.set('disable_guild_select', 'true')
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`
}
