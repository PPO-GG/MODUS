import { describe, expect, it } from 'vitest'
import { getModuleNeeds, MODULE_NAMES_WITH_REQUIREMENTS } from './module-requirements'

const POST_PERMS = ['ViewChannel', 'SendMessages', 'EmbedLinks']
const ids = (needs: ReturnType<typeof getModuleNeeds>) =>
  (needs?.channels ?? []).map((c) => c.id).sort()

describe('getModuleNeeds', () => {
  it('returns null for modules without requirements', () => {
    expect(getModuleNeeds('ping', {})).toBeNull()
    expect(getModuleNeeds('constructor', {})).toBeNull()
    expect(getModuleNeeds('__proto__', {})).toBeNull()
  })

  it('is case-insensitive on the module name', () => {
    expect(getModuleNeeds('Moderation', {})).not.toBeNull()
  })

  it('moderation: ban/kick/timeout/purge required, channel lock + audit log optional, mod-log channel', () => {
    const needs = getModuleNeeds('moderation', { modLogChannelId: 'log1' })!
    expect(needs.required).toEqual(['BanMembers', 'KickMembers', 'ModerateMembers', 'ManageMessages'])
    expect(needs.optional).toEqual(['ManageChannels', 'ManageRoles', 'ViewAuditLog'])
    expect(needs.channels).toEqual([
      { id: 'log1', label: 'mod-log channel', perms: ['ViewChannel', 'SendMessages', 'EmbedLinks'] },
    ])
  })

  it('antiraid: lockdown needs channel/role management; kick and ban actions add their permission', () => {
    expect(getModuleNeeds('antiraid', {})!.required).toEqual(['ManageChannels', 'ManageRoles'])
    expect(getModuleNeeds('antiraid', { action: 'kick' })!.required).toContain('KickMembers')
    expect(getModuleNeeds('antiraid', { action: 'ban' })!.required).toContain('BanMembers')
    expect(ids(getModuleNeeds('antiraid', { alertChannelId: 'a1' }))).toEqual(['a1'])
  })

  it('tickets: private threads in every parent channel, panel and transcript channels, no guild-wide perms', () => {
    const needs = getModuleNeeds('tickets', {
      panelChannelId: 'panel',
      transcriptChannelId: 'tr',
      defaultParentChannelId: 'p0',
      types: [{ parentChannelId: 'p1' }, { parentChannelId: 'p0' }, {}],
    })!
    expect(needs.required).toEqual([])
    expect(ids(needs)).toEqual(['p0', 'p1', 'panel', 'tr'])
    const parent = needs.channels.find((c) => c.id === 'p1')!
    expect(parent.perms).toEqual([
      'ViewChannel',
      'SendMessages',
      'EmbedLinks',
      'CreatePrivateThreads',
      'SendMessagesInThreads',
      'ManageThreads',
    ])
    // The transcript is posted as an attached file.
    expect(needs.channels.find((c) => c.id === 'tr')!.perms).toEqual([
      'ViewChannel',
      'SendMessages',
      'EmbedLinks',
      'AttachFiles',
    ])
  })

  it('merges permissions when two settings point at the same channel', () => {
    const needs = getModuleNeeds('tickets', { panelChannelId: 'same', defaultParentChannelId: 'same' })!
    expect(needs.channels).toHaveLength(1)
    expect(needs.channels[0]!.perms).toEqual([
      'ViewChannel',
      'SendMessages',
      'EmbedLinks',
      'CreatePrivateThreads',
      'SendMessagesInThreads',
      'ManageThreads',
    ])
    expect(needs.channels[0]!.label).toBe('ticket panel channel / ticket parent channel')
  })

  it('tempvoice: channel management perms it grants to owners; lobby and category channels', () => {
    const needs = getModuleNeeds('tempvoice', { lobbyChannelIds: ['l1', 'l2'], categoryId: 'cat' })!
    expect(needs.required).toEqual(['ManageChannels', 'MoveMembers', 'MuteMembers', 'DeafenMembers'])
    // /tempvoice lock and unlock edit channel permission overwrites.
    expect(needs.optional).toEqual(['ManageRoles'])
    expect(ids(needs)).toEqual(['cat', 'l1', 'l2'])
    expect(needs.channels.find((c) => c.id === 'l1')!.perms).toEqual(['ViewChannel', 'Connect', 'MoveMembers'])
    expect(needs.channels.find((c) => c.id === 'cat')!.perms).toEqual(['ViewChannel', 'ManageChannels'])
  })

  it('role-assigning modules require Manage Roles and expose the roles they assign', () => {
    const auto = getModuleNeeds('autoroles', {
      rules: [
        { roleId: 'r1', enabled: true },
        { roleId: 'r2', enabled: false },
        { roleId: 'r1' },
        'junk',
        null,
        { roleId: 42 },
      ],
    })!
    expect(auto.required).toEqual(['ManageRoles'])
    expect(auto.roleIds).toEqual(['r1'])

    const buttons = getModuleNeeds('reaction-roles', {
      panels: [{ channelId: 'pc', entries: [{ roleId: 'r3' }, { roleId: 'r4' }, {}] }, 7],
    })!
    expect(buttons.roleIds).toEqual(['r3', 'r4'])
    expect(ids(buttons)).toEqual(['pc'])

    const verify = getModuleNeeds('verification', {
      verificationChannelId: 'vc',
      buttons: [{ roleId: 'r5' }],
    })!
    expect(verify.roleIds).toEqual(['r5'])
    expect(ids(verify)).toEqual(['vc'])
  })

  it('logging, xp: only the configured channel', () => {
    expect(ids(getModuleNeeds('logging', { auditChannelId: 'al' }))).toEqual(['al'])
    expect(ids(getModuleNeeds('xp', { announcementChannel: 'xp1' }))).toEqual(['xp1'])
    // The level-up message is an embed.
    expect(getModuleNeeds('xp', { announcementChannel: 'xp1' })!.channels[0]!.perms).toEqual(POST_PERMS)
    expect(getModuleNeeds('xp', { announcementChannel: '' })!.channels).toEqual([])
    expect(getModuleNeeds('xp', { announcementChannel: null })!.channels).toEqual([])
  })

  it('music and recording: voice permissions guild-wide; music also renames the bot (optional)', () => {
    expect(getModuleNeeds('music', {})!.required).toEqual(['Connect', 'Speak'])
    expect(getModuleNeeds('music', {})!.optional).toEqual(['ChangeNickname'])
    expect(getModuleNeeds('recording', {})!.required).toEqual(['Connect'])
  })

  it('events creates scheduled events; polls sends native polls', () => {
    expect(getModuleNeeds('events', {})!.required).toEqual(['ManageEvents'])
    expect(getModuleNeeds('polls', {})!.required).toEqual(['SendPolls'])
  })

  it('automod: deleting messages is required; the other actions depend on the rule and are optional', () => {
    const needs = getModuleNeeds('automod', {})!
    expect(needs.required).toEqual(['ManageMessages'])
    expect(needs.optional).toEqual(['ModerateMembers', 'KickMembers', 'BanMembers', 'AddReactions'])
  })

  it('tickets pin the info message (optional, failure is swallowed)', () => {
    expect(getModuleNeeds('tickets', {})!.optional).toEqual(['PinMessages'])
  })

  it('never throws on malformed settings', () => {
    for (const settings of [null, undefined, 'x', 5, [], { types: 'no' }, { rules: {} }, { panels: [null] }, { lobbyChannelIds: 'l1' }]) {
      for (const name of MODULE_NAMES_WITH_REQUIREMENTS) {
        expect(() => getModuleNeeds(name, settings)).not.toThrow()
      }
    }
  })

  it('exposes the names that have requirements', () => {
    expect(MODULE_NAMES_WITH_REQUIREMENTS).toEqual(
      expect.arrayContaining(['moderation', 'tickets', 'tempvoice', 'autoroles', 'logging']),
    )
  })

  it('starboard: board channels need to be postable; disabled boards are ignored; no guild-wide perms', () => {
    const needs = getModuleNeeds('starboard', {
      boards: [
        { channelId: 'b1', enabled: true },
        { channelId: 'b2' },
        { channelId: 'off', enabled: false },
        { enabled: true },
      ],
    })!
    expect(needs.required).toEqual([])
    expect(needs.optional).toEqual([])
    expect(needs.channels).toEqual([
      { id: 'b1', label: 'starboard channel', perms: POST_PERMS },
      { id: 'b2', label: 'starboard channel', perms: POST_PERMS },
    ])
  })
})
