import { describe, expect, it } from 'vitest'
import { PERMISSION_BITS } from './discord-permissions'
import { MODULE_NAMES_WITH_REQUIREMENTS, getModuleNeeds } from './module-requirements'
import {
  INVITE_PERMISSION_NAMES,
  buildBotInviteUrl,
  getInvitePermissionBits,
} from './bot-invite'

// Every channel-referencing setting populated, so channel-level permissions
// appear in the needs. Two action variants cover antiraid's kick and ban.
const FULL_SETTINGS = {
  modLogChannelId: 'c1',
  alertChannelId: 'c1',
  panelChannelId: 'c1',
  transcriptChannelId: 'c1',
  defaultParentChannelId: 'c1',
  types: [{ parentChannelId: 'c2' }],
  lobbyChannelIds: ['c3'],
  categoryId: 'c4',
  panels: [{ channelId: 'c5', entries: [] }],
  verificationChannelId: 'c6',
  auditChannelId: 'c7',
  announcementChannel: 'c8',
  boards: [{ channelId: 'c9', enabled: true }],
}

describe('invite permission set', () => {
  it('never requests Administrator', () => {
    expect(INVITE_PERMISSION_NAMES).not.toContain('Administrator')
    const bits = BigInt(getInvitePermissionBits())
    expect((bits & PERMISSION_BITS.Administrator) === PERMISSION_BITS.Administrator).toBe(false)
  })

  it('has no duplicate names', () => {
    expect(new Set(INVITE_PERMISSION_NAMES).size).toBe(INVITE_PERMISSION_NAMES.length)
  })

  it('includes Create Public Threads, which the Read-only permission preset grants to staff roles', () => {
    expect(INVITE_PERMISSION_NAMES).toContain('CreatePublicThreads')
  })

  it('covers everything every module can require, drift guard against module-requirements.ts', () => {
    const granted = new Set(INVITE_PERMISSION_NAMES)
    const missing: string[] = []
    for (const name of MODULE_NAMES_WITH_REQUIREMENTS) {
      for (const settings of [FULL_SETTINGS, { ...FULL_SETTINGS, action: 'kick' }, { ...FULL_SETTINGS, action: 'ban' }]) {
        const needs = getModuleNeeds(name, settings)!
        const wanted = [...needs.required, ...needs.optional, ...needs.channels.flatMap((c) => c.perms)]
        for (const perm of wanted) if (!granted.has(perm)) missing.push(`${name}: ${perm}`)
      }
    }
    expect([...new Set(missing)]).toEqual([])
  })

  it('includes a posting baseline for modules without fixed requirements', () => {
    for (const perm of ['ViewChannel', 'SendMessages', 'EmbedLinks', 'AttachFiles', 'ReadMessageHistory'] as const) {
      expect(INVITE_PERMISSION_NAMES).toContain(perm)
    }
  })
})

describe('getInvitePermissionBits', () => {
  it('is the decimal OR of every requested permission', () => {
    const bits = getInvitePermissionBits()
    expect(bits).toMatch(/^\d+$/)
    const expected = INVITE_PERMISSION_NAMES.reduce((acc, n) => acc | PERMISSION_BITS[n], BigInt(0))
    expect(bits).toBe(expected.toString())
  })
})

describe('buildBotInviteUrl', () => {
  it('builds the OAuth URL with bot scopes and the least-privilege bits', () => {
    const url = new URL(buildBotInviteUrl('123'))
    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize')
    expect(url.searchParams.get('client_id')).toBe('123')
    expect(url.searchParams.get('scope')).toBe('bot applications.commands')
    expect(url.searchParams.get('permissions')).toBe(getInvitePermissionBits())
    expect(url.searchParams.get('permissions')).not.toBe('8')
    expect(url.searchParams.has('guild_id')).toBe(false)
  })

  it('pre-selects a guild and locks the picker when given one', () => {
    const url = new URL(buildBotInviteUrl('123', { guildId: '456' }))
    expect(url.searchParams.get('guild_id')).toBe('456')
    expect(url.searchParams.get('disable_guild_select')).toBe('true')
  })
})
