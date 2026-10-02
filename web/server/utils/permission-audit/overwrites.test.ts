import { describe, expect, it } from 'vitest'
import { PERMISSION_BITS as P } from '../../../shared/discord-permissions'
import {
  GUILD_ID,
  bits,
  botRole,
  category,
  everyoneRole,
  makeInput,
  overwrite,
  textChannel,
} from './fixtures'
import { checkOverwrites } from './overwrites'

const ZERO = BigInt(0)
const withChannels = (channels: ReturnType<typeof textChannel>[], roles = [everyoneRole(), botRole()]) =>
  makeInput({ roles, channels })

describe('checkOverwrites', () => {
  it('reports nothing when there are no channels or no overwrites', () => {
    expect(checkOverwrites(makeInput())).toEqual([])
    expect(checkOverwrites(withChannels([{ id: 'c', name: 'c', type: 0 }]))).toEqual([])
  })

  it('flags an @everyone overwrite granting a management permission as critical', () => {
    const findings = checkOverwrites(
      withChannels([textChannel('c1', 'general', [overwrite(GUILD_ID, 0, P.ManageChannels | P.ManageWebhooks)])]),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      id: 'everyone-channel-manage:c1',
      check: 'overwrites',
      severity: 'critical',
      subject: { type: 'channel', id: 'c1', name: 'general' },
    })
    expect(findings[0]!.title).toContain('Manage Channels')
    expect(findings[0]!.title).toContain('Manage Webhooks')
  })

  it('flags an @everyone overwrite granting Mention Everyone as a warning', () => {
    const findings = checkOverwrites(
      withChannels([textChannel('c1', 'general', [overwrite(GUILD_ID, 0, P.MentionEveryone)])]),
    )
    expect(findings.map((f) => [f.id, f.severity])).toEqual([['everyone-channel-mention:c1', 'warning']])
  })

  it('does not flag a deny, or a grant to a non-@everyone role', () => {
    const findings = checkOverwrites(
      withChannels([
        textChannel('c1', 'general', [
          overwrite(GUILD_ID, 0, ZERO, P.ManageChannels),
          overwrite('77', 0, P.ManageRoles),
          overwrite('88', 1, P.ManageRoles),
        ]),
      ]),
    )
    expect(findings).toEqual([])
  })

  it('flags a child that lets @everyone view inside a category that hides it', () => {
    const findings = checkOverwrites(
      withChannels([
        category('cat', 'Staff', [overwrite(GUILD_ID, 0, ZERO, P.ViewChannel)]),
        textChannel('child', 'mod-chat', [overwrite(GUILD_ID, 0, P.ViewChannel)], 'cat'),
      ]),
    )
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      id: 'child-exposed:child',
      check: 'overwrites',
      severity: 'warning',
      subject: { type: 'channel', id: 'child', name: 'mod-chat' },
    })
    expect(findings[0]!.detail).toContain('Staff')
  })

  it('does not flag a child that inherits the private category overwrites', () => {
    const findings = checkOverwrites(
      withChannels([
        category('cat', 'Staff', [overwrite(GUILD_ID, 0, ZERO, P.ViewChannel)]),
        textChannel('child', 'mod-chat', [overwrite(GUILD_ID, 0, ZERO, P.ViewChannel)], 'cat'),
      ]),
    )
    expect(findings).toEqual([])
  })

  it('does not flag children of a public category', () => {
    const findings = checkOverwrites(
      withChannels([category('cat', 'Public'), textChannel('child', 'general', [], 'cat')]),
    )
    expect(findings).toEqual([])
  })

  it('does not report false exposure when @everyone has Administrator', () => {
    const findings = checkOverwrites(
      withChannels(
        [
          category('cat', 'Staff', [overwrite(GUILD_ID, 0, ZERO, P.ViewChannel)]),
          textChannel('child', 'mod-chat', [], 'cat'),
        ],
        [everyoneRole(bits(P.Administrator)), botRole()],
      ),
    )
    expect(findings).toEqual([])
  })

  it('ignores a child whose parent is not in the channel list', () => {
    expect(checkOverwrites(withChannels([textChannel('child', 'x', [], 'missing-cat')]))).toEqual([])
  })

  it('marks the three channel overwrite rules as fixable', () => {
    const findings = checkOverwrites(
      withChannels([
        category('cat', 'Staff', [overwrite(GUILD_ID, 0, ZERO, P.ViewChannel)]),
        textChannel('child', 'mod-chat', [overwrite(GUILD_ID, 0, P.ViewChannel | P.ManageChannels | P.MentionEveryone)], 'cat'),
      ]),
    )
    expect(findings.map((f) => f.id).sort()).toEqual([
      'child-exposed:child',
      'everyone-channel-manage:child',
      'everyone-channel-mention:child',
    ])
    expect(findings.every((f) => f.fixable === true)).toBe(true)
  })

  it('handles a large guild', () => {
    const channels = Array.from({ length: 2000 }, (_, i) => textChannel(`c${i}`, `chan-${i}`))
    expect(checkOverwrites(withChannels(channels))).toEqual([])
  })
})
