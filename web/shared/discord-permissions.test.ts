import { describe, expect, it } from 'vitest'
import {
  ALL_PERMISSIONS,
  PERMISSION_BITS as P,
  computeBasePermissions,
  computeChannelPermissions,
  hasPermission,
  heldPermissions,
  missingPermissions,
  parseBits,
  permissionLabel,
  permissionNames,
  type ChannelLike,
  type OverwriteLike,
  type RoleLike,
} from './discord-permissions'

const GUILD = '100'
const ZERO = BigInt(0)

const role = (id: string, bits: bigint): RoleLike => ({
  id,
  name: `role-${id}`,
  position: 1,
  permissions: bits.toString(),
})
const ow = (id: string, type: 0 | 1, allow = ZERO, deny = ZERO): OverwriteLike => ({
  id,
  type,
  allow: allow.toString(),
  deny: deny.toString(),
})
const channel = (overwrites: OverwriteLike[] = []): ChannelLike => ({
  id: 'c1',
  name: 'general',
  type: 0,
  permission_overwrites: overwrites,
})

describe('computeBasePermissions', () => {
  const roles = [
    role(GUILD, P.ViewChannel),
    role('r1', P.SendMessages),
    role('r2', P.ManageRoles),
  ]

  it('ORs @everyone with the roles the member holds and ignores other roles', () => {
    const base = computeBasePermissions(GUILD, roles, ['r1'])
    expect(hasPermission(base, 'ViewChannel')).toBe(true)
    expect(hasPermission(base, 'SendMessages')).toBe(true)
    expect(hasPermission(base, 'ManageRoles')).toBe(false)
  })

  it('returns every permission when Administrator is held', () => {
    const base = computeBasePermissions(GUILD, [role(GUILD, ZERO), role('a', P.Administrator)], ['a'])
    expect(base).toBe(ALL_PERMISSIONS)
  })

  it('returns zero when there is no @everyone role and no member roles', () => {
    expect(computeBasePermissions(GUILD, [], [])).toBe(ZERO)
  })
})

describe('computeChannelPermissions', () => {
  const base = P.ViewChannel | P.SendMessages

  it('returns the base permissions when the channel has no overwrites', () => {
    expect(computeChannelPermissions(base, channel(), GUILD, 'u1', [])).toBe(base)
    expect(
      computeChannelPermissions(base, { id: 'c', name: 'c', type: 0 }, GUILD, 'u1', []),
    ).toBe(base)
  })

  it('applies the @everyone overwrite (deny removes a permission)', () => {
    const perms = computeChannelPermissions(base, channel([ow(GUILD, 0, ZERO, P.SendMessages)]), GUILD, 'u1', [])
    expect(hasPermission(perms, 'SendMessages')).toBe(false)
    expect(hasPermission(perms, 'ViewChannel')).toBe(true)
  })

  it('lets a role allow beat the @everyone deny', () => {
    const perms = computeChannelPermissions(
      base,
      channel([ow(GUILD, 0, ZERO, P.SendMessages), ow('r1', 0, P.SendMessages)]),
      GUILD,
      'u1',
      ['r1'],
    )
    expect(hasPermission(perms, 'SendMessages')).toBe(true)
  })

  it('lets one role allow beat another role deny (allows are applied after denies)', () => {
    const perms = computeChannelPermissions(
      base,
      channel([ow('r1', 0, ZERO, P.SendMessages), ow('r2', 0, P.SendMessages)]),
      GUILD,
      'u1',
      ['r1', 'r2'],
    )
    expect(hasPermission(perms, 'SendMessages')).toBe(true)
  })

  it('lets the member overwrite beat role overwrites', () => {
    const perms = computeChannelPermissions(
      base,
      channel([ow('r1', 0, P.SendMessages), ow('u1', 1, ZERO, P.SendMessages)]),
      GUILD,
      'u1',
      ['r1'],
    )
    expect(hasPermission(perms, 'SendMessages')).toBe(false)
  })

  it('ignores overwrites for roles the member does not hold', () => {
    const perms = computeChannelPermissions(base, channel([ow('r9', 0, ZERO, P.SendMessages)]), GUILD, 'u1', ['r1'])
    expect(hasPermission(perms, 'SendMessages')).toBe(true)
  })

  it('short-circuits to every permission for Administrator regardless of overwrites', () => {
    const perms = computeChannelPermissions(
      ALL_PERMISSIONS,
      channel([ow(GUILD, 0, ZERO, P.ViewChannel)]),
      GUILD,
      'u1',
      [],
    )
    expect(perms).toBe(ALL_PERMISSIONS)
  })
})

describe('permission helpers', () => {
  it('parseBits tolerates garbage and returns zero', () => {
    expect(parseBits('8')).toBe(BigInt(8))
    expect(parseBits('not a number')).toBe(ZERO)
    expect(parseBits(undefined)).toBe(ZERO)
    expect(parseBits(null)).toBe(ZERO)
  })

  it('missingPermissions / heldPermissions partition a list', () => {
    const bits = P.ViewChannel | P.SendMessages
    expect(missingPermissions(bits, ['ViewChannel', 'EmbedLinks'])).toEqual(['EmbedLinks'])
    expect(heldPermissions(bits, ['ViewChannel', 'EmbedLinks'])).toEqual(['ViewChannel'])
  })

  it('permissionNames lists only the known permissions set in a bitfield, ignoring unknown bits', () => {
    const unknown = BigInt(1) << BigInt(60)
    expect(permissionNames(P.ViewChannel | P.ManageRoles | unknown)).toEqual(['ViewChannel', 'ManageRoles'])
    expect(permissionNames(BigInt(0))).toEqual([])
  })

  it("permissionLabel uses the names Discord's role settings show where they differ from the API names", () => {
    expect(permissionLabel('ModerateMembers')).toBe('Timeout Members')
    expect(permissionLabel('ManageGuild')).toBe('Manage Server')
    expect(permissionLabel('SendPolls')).toBe('Create Polls')
  })

  it('permissionLabel splits camel case into words', () => {
    expect(permissionLabel('ManageChannels')).toBe('Manage Channels')
    expect(permissionLabel('SendMessagesInThreads')).toBe('Send Messages In Threads')
    expect(permissionLabel('ViewAuditLog')).toBe('View Audit Log')
  })

  it('has the documented bit positions for every permission', () => {
    expect(P.Administrator).toBe(BigInt(8))
    expect(P.ViewChannel).toBe(BigInt(1) << BigInt(10))
    expect(P.ManageRoles).toBe(BigInt(1) << BigInt(28))
    expect(P.ManageThreads).toBe(BigInt(1) << BigInt(34))
    expect(P.CreatePrivateThreads).toBe(BigInt(1) << BigInt(36))
    expect(P.SendMessagesInThreads).toBe(BigInt(1) << BigInt(38))
    expect(P.ModerateMembers).toBe(BigInt(1) << BigInt(40))
  })

  it('has the documented bit positions for the invite-only permissions', () => {
    expect(P.AddReactions).toBe(BigInt(1) << BigInt(6))
    expect(P.ReadMessageHistory).toBe(BigInt(1) << BigInt(16))
    expect(P.UseExternalEmojis).toBe(BigInt(1) << BigInt(18))
    expect(P.ChangeNickname).toBe(BigInt(1) << BigInt(26))
    expect(P.ManageEvents).toBe(BigInt(1) << BigInt(33))
    expect(P.SendPolls).toBe(BigInt(1) << BigInt(49))
    expect(P.PinMessages).toBe(BigInt(1) << BigInt(51))
  })

  it('has the documented bit position for Create Public Threads', () => {
    expect(P.CreatePublicThreads).toBe(BigInt(1) << BigInt(35))
  })
})
