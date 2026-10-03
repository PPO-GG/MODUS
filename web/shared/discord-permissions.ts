/**
 * Shared (isomorphic) Discord permission-bit helper — usable from both
 * `app/` (client) and `server/` (Nitro) since it has no side effects.
 */
const ADMINISTRATOR_BIT = BigInt(0x8);
const MANAGE_GUILD_BIT = BigInt(0x20);

/**
 * True when a Discord permissions bitfield (as returned by the OAuth
 * `/users/@me/guilds` or guild-member endpoints, always a string on the
 * wire) includes ADMINISTRATOR.
 */
export function hasAdministratorPermission(
  permissions: string | bigint | null | undefined,
): boolean {
  if (permissions == null) return false;
  try {
    const bits = typeof permissions === "bigint" ? permissions : BigInt(permissions);
    return (bits & ADMINISTRATOR_BIT) === ADMINISTRATOR_BIT;
  } catch {
    return false;
  }
}

/**
 * True when the bitfield includes ADMINISTRATOR or MANAGE_GUILD. This is
 * the dashboard-access gate: Discord itself only requires Manage Server
 * to invite a bot, so anyone who can add the bot can also connect the
 * guild to the dashboard.
 */
export function canManageGuild(
  permissions: string | bigint | null | undefined,
): boolean {
  if (permissions == null) return false;
  try {
    const bits = typeof permissions === "bigint" ? permissions : BigInt(permissions);
    return (
      (bits & ADMINISTRATOR_BIT) === ADMINISTRATOR_BIT ||
      (bits & MANAGE_GUILD_BIT) === MANAGE_GUILD_BIT
    );
  } catch {
    return false;
  }
}

// ── Permission audit helpers ────────────────────────────────────────────

const bit = (n: number): bigint => BigInt(1) << BigInt(n)

/**
 * Discord permission bits used by the audit and the module requirement table.
 * Positions: https://discord.com/developers/docs/topics/permissions
 */
export const PERMISSION_BITS = {
  KickMembers: bit(1),
  BanMembers: bit(2),
  Administrator: bit(3),
  ManageChannels: bit(4),
  ManageGuild: bit(5),
  AddReactions: bit(6),
  ViewAuditLog: bit(7),
  ViewChannel: bit(10),
  SendMessages: bit(11),
  ManageMessages: bit(13),
  EmbedLinks: bit(14),
  AttachFiles: bit(15),
  ReadMessageHistory: bit(16),
  MentionEveryone: bit(17),
  UseExternalEmojis: bit(18),
  Connect: bit(20),
  Speak: bit(21),
  MuteMembers: bit(22),
  DeafenMembers: bit(23),
  MoveMembers: bit(24),
  ChangeNickname: bit(26),
  ManageNicknames: bit(27),
  ManageRoles: bit(28),
  ManageWebhooks: bit(29),
  ManageEvents: bit(33),
  ManageThreads: bit(34),
  CreatePublicThreads: bit(35),
  CreatePrivateThreads: bit(36),
  SendMessagesInThreads: bit(38),
  ModerateMembers: bit(40),
  SendPolls: bit(49),
  PinMessages: bit(51),
} as const

export type PermissionName = keyof typeof PERMISSION_BITS

/** Every bit set — what Administrator effectively grants. */
export const ALL_PERMISSIONS = (BigInt(1) << BigInt(64)) - BigInt(1)

/** `ManageChannels` → `Manage Channels`. */
export function permissionLabel(name: PermissionName): string {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2')
}

/** Parse a Discord permission string; garbage becomes 0 instead of throwing. */
export function parseBits(value: unknown): bigint {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    return BigInt(0)
  }
  try {
    return BigInt(value)
  } catch {
    return BigInt(0)
  }
}

export function hasPermission(bits: bigint, name: PermissionName): boolean {
  const flag = PERMISSION_BITS[name]
  return (bits & flag) === flag
}

export function missingPermissions(
  bits: bigint,
  names: readonly PermissionName[],
): PermissionName[] {
  return names.filter((name) => !hasPermission(bits, name))
}

export function heldPermissions(
  bits: bigint,
  names: readonly PermissionName[],
): PermissionName[] {
  return names.filter((name) => hasPermission(bits, name))
}

/** The known permissions set in a bitfield (unknown bits are ignored). */
export function permissionNames(bits: bigint): PermissionName[] {
  return (Object.keys(PERMISSION_BITS) as PermissionName[]).filter((name) =>
    hasPermission(bits, name),
  )
}

/** Subset of Discord's role object the audit reads. */
export interface RoleLike {
  id: string
  name: string
  position: number
  /** Permission bitfield as a decimal string (always a string on the wire). */
  permissions: string
  managed?: boolean
}

/** `type` is 0 for a role overwrite, 1 for a member overwrite. */
export interface OverwriteLike {
  id: string
  type: number
  allow: string
  deny: string
}

/** Subset of Discord's channel object the audit reads. Type 4 = category. */
export interface ChannelLike {
  id: string
  name: string
  type: number
  parent_id?: string | null
  permission_overwrites?: OverwriteLike[]
}

/**
 * Guild-level permissions: @everyone OR the member's roles. Administrator
 * short-circuits to every permission. `guildId` doubles as the @everyone
 * role id.
 */
export function computeBasePermissions(
  guildId: string,
  roles: readonly RoleLike[],
  memberRoleIds: readonly string[],
): bigint {
  let perms = BigInt(0)
  for (const role of roles) {
    if (role.id === guildId || memberRoleIds.includes(role.id)) {
      perms |= parseBits(role.permissions)
    }
  }
  return hasPermission(perms, 'Administrator') ? ALL_PERMISSIONS : perms
}

/**
 * Effective permissions in one channel, following Discord's documented
 * order: base → @everyone overwrite → all of the member's role overwrites
 * (denies removed, then allows added) → the member's own overwrite.
 * Pass `memberId = ''` and `memberRoleIds = []` to evaluate @everyone alone.
 */
export function computeChannelPermissions(
  base: bigint,
  channel: ChannelLike,
  guildId: string,
  memberId: string,
  memberRoleIds: readonly string[],
): bigint {
  if (hasPermission(base, 'Administrator')) return ALL_PERMISSIONS

  const overwrites = channel.permission_overwrites ?? []
  let perms = base

  const everyone = overwrites.find((o) => o.type === 0 && o.id === guildId)
  if (everyone) perms = (perms & ~parseBits(everyone.deny)) | parseBits(everyone.allow)

  let roleAllow = BigInt(0)
  let roleDeny = BigInt(0)
  for (const o of overwrites) {
    if (o.type === 0 && o.id !== guildId && memberRoleIds.includes(o.id)) {
      roleAllow |= parseBits(o.allow)
      roleDeny |= parseBits(o.deny)
    }
  }
  perms = (perms & ~roleDeny) | roleAllow

  const member = overwrites.find((o) => o.type === 1 && o.id === memberId)
  if (member) perms = (perms & ~parseBits(member.deny)) | parseBits(member.allow)

  return perms
}
