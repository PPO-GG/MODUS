import { describe, expect, it } from 'vitest'
import { INVITE_BASELINE_NAMES, INVITE_PERMISSION_NAMES } from '../../../shared/bot-invite'
import { permissionLabel } from '../../../shared/discord-permissions'
import { describeAdminBotNeeds } from './admin-needs'
import { makeInput, textChannel } from './fixtures'

const lines = (text: string) => text.split('\n')

describe('describeAdminBotNeeds', () => {
  const input = () =>
    makeInput({
      channels: [textChannel('log', 'mod-log')],
      modules: [
        { name: 'moderation', enabled: true, settings: { modLogChannelId: 'log' } },
        { name: 'autoroles', enabled: true, settings: {} },
        { name: 'verification', enabled: true, settings: {} },
      ],
    })

  it('lists required permissions once each, with every module that needs them, in a stable order', () => {
    const text = lines(describeAdminBotNeeds(input()))
    const start = text.indexOf('Required (a module fails without these):')
    expect(start).toBeGreaterThan(0)
    expect(text.slice(start + 1, start + 6)).toEqual([
      '• Kick Members — moderation',
      '• Ban Members — moderation',
      '• Manage Messages — moderation',
      '• Manage Roles — autoroles, verification',
      '• Moderate Members — moderation',
    ])
  })

  it('lists optional permissions that are not already required by another module', () => {
    const text = lines(describeAdminBotNeeds(input()))
    const start = text.indexOf('Optional (a feature degrades without these):')
    expect(start).toBeGreaterThan(0)
    expect(text.slice(start + 1, start + 3)).toEqual([
      '• Manage Channels — moderation',
      '• View Audit Log — moderation',
    ])
    // Manage Roles is optional for moderation but required by autoroles: shown once, under Required.
    expect(text.filter((l) => l.startsWith('• Manage Roles'))).toHaveLength(1)
  })

  it('lists the permissions needed in each configured channel, by name', () => {
    const text = describeAdminBotNeeds(input())
    expect(text).toContain('In specific channels:')
    expect(text).toContain('• #mod-log: View Channel, Send Messages, Embed Links (moderation)')
  })

  it('skips a configured channel that no longer exists (the channel-missing finding covers it)', () => {
    const text = describeAdminBotNeeds(
      makeInput({
        channels: [],
        modules: [{ name: 'moderation', enabled: true, settings: { modLogChannelId: 'gone' } }],
      }),
    )
    expect(text).not.toContain('In specific channels:')
    expect(text).not.toContain('#')
  })

  it('ignores disabled modules and modules without requirements', () => {
    const text = describeAdminBotNeeds(
      makeInput({
        modules: [
          { name: 'moderation', enabled: false, settings: {} },
          { name: 'ping', enabled: true, settings: {} },
        ],
      }),
    )
    expect(text).toContain('No configured modules need specific permissions yet.')
    expect(text).not.toContain('Required (')
    expect(text).not.toContain('Kick Members')
  })

  it('with no modules still explains the basics and where the full list is', () => {
    const text = describeAdminBotNeeds(makeInput())
    expect(text).toContain('No configured modules need specific permissions yet.')
  })

  it('always names the basic messaging permissions and the full invite list size', () => {
    for (const text of [describeAdminBotNeeds(input()), describeAdminBotNeeds(makeInput())]) {
      expect(text).toContain(
        `Basic messaging in any channel it posts in: ${INVITE_BASELINE_NAMES.map(permissionLabel).join(', ')}.`,
      )
      expect(text).toContain(
        `Everything MODUS can use is the ${INVITE_PERMISSION_NAMES.length} permissions in the invite list (Discover Servers → Invite Bot to Server).`,
      )
    }
  })

  it('does not throw on malformed module settings', () => {
    const text = describeAdminBotNeeds(
      makeInput({
        modules: [
          { name: 'tickets', enabled: true, settings: { types: 'x' } as any },
          { name: 'tempvoice', enabled: true, settings: null as any },
        ],
      }),
    )
    expect(typeof text).toBe('string')
  })

  it('does not mutate the input', () => {
    const before = JSON.stringify(input())
    const i = input()
    describeAdminBotNeeds(i)
    expect(JSON.stringify(i)).toBe(before)
  })
})
