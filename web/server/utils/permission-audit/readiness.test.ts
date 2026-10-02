import { describe, expect, it } from 'vitest'
import { PERMISSION_BITS as P } from '../../../shared/discord-permissions'
import {
  BOT_ID,
  BOT_ROLE_ID,
  GUILD_ID,
  bits,
  botRole,
  everyoneRole,
  makeInput,
  overwrite,
  textChannel,
} from './fixtures'
import { checkReadiness } from './readiness'

const ZERO = BigInt(0)
const MOD_PERMS = bits(P.ViewChannel, P.SendMessages, P.EmbedLinks, P.BanMembers, P.KickMembers, P.ModerateMembers, P.ManageMessages)
const moderation = (settings = {}) => ({ name: 'moderation', enabled: true, settings })
const logging = (settings = {}) => ({ name: 'logging', enabled: true, settings })

describe('checkReadiness', () => {
  it('reports nothing when the bot has Administrator', () => {
    const input = makeInput({
      roles: [everyoneRole(), botRole(bits(P.Administrator))],
      modules: [moderation({ modLogChannelId: 'gone' }), { name: 'tempvoice', enabled: true, settings: {} }],
    })
    expect(checkReadiness(input)).toEqual([])
  })

  it('reports nothing when every requirement is met', () => {
    const input = makeInput({
      roles: [everyoneRole(), botRole(bits(P.ViewChannel, P.SendMessages, P.EmbedLinks, P.BanMembers, P.KickMembers, P.ModerateMembers, P.ManageMessages, P.ManageChannels, P.ManageRoles, P.ViewAuditLog))],
      channels: [textChannel('log', 'mod-log')],
      modules: [moderation({ modLogChannelId: 'log' })],
    })
    expect(checkReadiness(input)).toEqual([])
  })

  it('flags missing required guild-wide permissions as critical, naming them', () => {
    const input = makeInput({
      roles: [everyoneRole(), botRole(bits(P.ViewChannel, P.SendMessages, P.KickMembers))],
      modules: [moderation()],
    })
    const finding = checkReadiness(input).find((f) => f.id === 'missing-guild-perms:moderation')!
    expect(finding).toMatchObject({
      check: 'readiness',
      severity: 'critical',
      subject: { type: 'module', id: 'moderation', name: 'moderation' },
    })
    expect(finding.title).toContain('Ban Members')
    expect(finding.title).toContain('Moderate Members')
    expect(finding.title).not.toContain('Kick Members')
  })

  it('flags missing optional permissions as a warning', () => {
    const input = makeInput({
      roles: [everyoneRole(), botRole(MOD_PERMS)],
      modules: [moderation()],
    })
    const findings = checkReadiness(input)
    expect(findings.map((f) => [f.id, f.severity])).toEqual([['missing-optional-perms:moderation', 'warning']])
    expect(findings[0]!.detail).toContain('Manage Channels')
  })

  it('ignores disabled modules and modules without requirements', () => {
    const input = makeInput({
      roles: [everyoneRole(), botRole('0')],
      modules: [{ name: 'moderation', enabled: false, settings: {} }, { name: 'ping', enabled: true, settings: {} }],
    })
    expect(checkReadiness(input)).toEqual([])
  })

  it('flags a configured channel where an @everyone deny removes the bot permissions', () => {
    const input = makeInput({
      roles: [everyoneRole(), botRole(bits(P.ViewChannel, P.SendMessages, P.EmbedLinks))],
      channels: [textChannel('c1', 'audit', [overwrite(GUILD_ID, 0, ZERO, P.ViewChannel | P.SendMessages)])],
      modules: [logging({ auditChannelId: 'c1' })],
    })
    const finding = checkReadiness(input).find((f) => f.id === 'channel-perms:logging:c1')!
    expect(finding).toMatchObject({
      severity: 'critical',
      subject: { type: 'channel', id: 'c1', name: 'audit' },
    })
    expect(finding.title).toContain('View Channel')
    expect(finding.title).toContain('Send Messages')
    expect(finding.title).not.toContain('Embed Links')
  })

  it('does not flag the channel when the bot role has an allow overwrite', () => {
    const input = makeInput({
      roles: [everyoneRole(), botRole(bits(P.ViewChannel, P.SendMessages, P.EmbedLinks))],
      channels: [
        textChannel('c1', 'audit', [
          overwrite(GUILD_ID, 0, ZERO, P.ViewChannel),
          overwrite(BOT_ROLE_ID, 0, P.ViewChannel),
        ]),
      ],
      modules: [logging({ auditChannelId: 'c1' })],
    })
    expect(checkReadiness(input)).toEqual([])
  })

  it('honours a member overwrite that targets the bot user', () => {
    const input = makeInput({
      roles: [everyoneRole(), botRole(bits(P.ViewChannel, P.SendMessages, P.EmbedLinks))],
      channels: [textChannel('c1', 'audit', [overwrite(BOT_ID, 1, ZERO, P.SendMessages)])],
      modules: [logging({ auditChannelId: 'c1' })],
    })
    expect(checkReadiness(input).map((f) => f.id)).toEqual(['channel-perms:logging:c1'])
  })

  it('warns instead of throwing when a configured channel no longer exists', () => {
    const input = makeInput({
      roles: [everyoneRole(), botRole(bits(P.ViewChannel, P.SendMessages, P.EmbedLinks))],
      modules: [logging({ auditChannelId: 'gone' })],
    })
    const findings = checkReadiness(input)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      id: 'channel-missing:logging:gone',
      severity: 'warning',
      subject: { type: 'module', id: 'logging' },
    })
  })

  it('does not throw on malformed module settings', () => {
    const input = makeInput({
      roles: [everyoneRole(), botRole('0')],
      modules: [
        { name: 'tickets', enabled: true, settings: { types: 'x', defaultParentChannelId: 7 } as any },
        { name: 'tempvoice', enabled: true, settings: null as any },
      ],
    })
    expect(() => checkReadiness(input)).not.toThrow()
  })
})
