import { describe, expect, it } from 'vitest'
import { PERMISSION_BITS as P } from '../../../shared/discord-permissions'
import { MAX_PRESET_CHANGES, type PresetRequest } from '../../../shared/permission-presets'
import {
  GUILD_ID,
  botRole,
  category,
  everyoneRole,
  makeInput,
  overwrite,
  role,
  textChannel,
  voiceChannel,
} from './fixtures'
import { planPreset } from './presets'

const ZERO = BigInt(0)
const UNKNOWN_BIT = BigInt(1) << BigInt(60)
const READ_ONLY_DENY = P.SendMessages | P.AddReactions | P.SendMessagesInThreads | P.CreatePublicThreads | P.CreatePrivateThreads
const POSTER_ALLOW = P.SendMessages | P.AddReactions | P.SendMessagesInThreads | P.CreatePublicThreads

const guild = (channels = [textChannel('c1', 'general')]) =>
  makeInput({
    roles: [everyoneRole(), botRole(), role('601', 'Staff', '0', 3), role('602', 'Members', '0', 2)],
    channels,
  })

const req = (over: Partial<PresetRequest> = {}): PresetRequest => ({
  presetId: 'read-only',
  slots: { posters: ['601'] },
  channelIds: ['c1'],
  ...over,
})

describe('planPreset: Read-only', () => {
  it('on a fresh text channel sets @everyone (deny only) and each poster role (allow only)', () => {
    const { plan, problems, stats } = planPreset(guild(), req())
    expect(problems).toEqual([])
    expect(stats).toEqual({ channels: 1, changed: 1, unchanged: 0, changes: 2 })
    expect(plan!.findingId).toBe('preset:read-only')
    expect(plan!.summary).toContain('Read-only')
    expect(plan!.hash).toMatch(/^[0-9a-f]{64}$/)
    const [staff, everyone] = plan!.changes
    expect(everyone).toMatchObject({ channelId: 'c1', channelName: 'general', op: 'set-overwrite', targetId: GUILD_ID, targetType: 0, before: [] })
    expect(everyone!.after[0]).toMatchObject({ id: GUILD_ID, label: '@everyone', allow: '0', deny: READ_ONLY_DENY.toString() })
    expect(staff).toMatchObject({ targetId: '601', targetType: 0, before: [] })
    expect(staff!.after[0]).toMatchObject({ id: '601', label: 'Staff', allow: POSTER_ALLOW.toString(), deny: '0' })
  })

  it('never grants View Channel', () => {
    const { plan } = planPreset(guild(), req())
    for (const change of plan!.changes) {
      expect(BigInt(change.after[0]!.allow) & P.ViewChannel).toBe(ZERO)
    }
  })

  it('with no poster roles only changes @everyone', () => {
    const { plan, stats } = planPreset(guild(), req({ slots: { posters: [] } }))
    expect(plan!.changes).toHaveLength(1)
    expect(stats!.changes).toBe(1)
  })

  it('merges into existing overwrites: keeps unrelated bits, bits with no name, and other roles untouched', () => {
    const input = guild([
      textChannel('c1', 'general', [
        overwrite(GUILD_ID, 0, P.ViewChannel | P.AttachFiles, P.EmbedLinks | UNKNOWN_BIT),
        overwrite('602', 0, P.SendMessages),
        overwrite('900', 1, P.ManageRoles),
      ]),
    ])
    const { plan } = planPreset(input, req())
    expect(plan!.changes.map((c) => c.targetId)).toEqual(['601', GUILD_ID])
    const after = plan!.changes[1]!.after[0]!
    expect(after.allow).toBe((P.ViewChannel | P.AttachFiles).toString())
    expect(after.deny).toBe((P.EmbedLinks | UNKNOWN_BIT | READ_ONLY_DENY).toString())
    expect(plan!.changes[1]!.before[0]!.allow).toBe((P.ViewChannel | P.AttachFiles).toString())
  })

  it("moves a bit from allow to deny when the preset denies it, and from deny to allow when a role is granted it", () => {
    const input = guild([
      textChannel('c1', 'general', [
        overwrite(GUILD_ID, 0, P.SendMessages | P.ViewChannel),
        overwrite('601', 0, ZERO, P.SendMessages | P.AttachFiles),
      ]),
    ])
    const { plan } = planPreset(input, req())
    const everyone = plan!.changes.find((c) => c.targetId === GUILD_ID)!.after[0]!
    expect(everyone.allow).toBe(P.ViewChannel.toString())
    expect(BigInt(everyone.deny) & P.SendMessages).toBe(P.SendMessages)
    const staff = plan!.changes.find((c) => c.targetId === '601')!.after[0]!
    expect(staff.deny).toBe(P.AttachFiles.toString())
    expect(BigInt(staff.allow) & P.SendMessages).toBe(P.SendMessages)
  })

  it('skips channels that already match and reports them', () => {
    const input = guild([
      textChannel('c1', 'general', [overwrite(GUILD_ID, 0, ZERO, READ_ONLY_DENY), overwrite('601', 0, POSTER_ALLOW)]),
      textChannel('c2', 'news'),
    ])
    const { plan, stats } = planPreset(input, req({ channelIds: ['c1', 'c2'] }))
    expect(stats).toEqual({ channels: 2, changed: 1, unchanged: 1, changes: 2 })
    expect(plan!.changes.every((c) => c.channelId === 'c2')).toBe(true)
  })

  it('returns a null plan with a clear problem when every channel already matches', () => {
    const input = guild([
      textChannel('c1', 'general', [overwrite(GUILD_ID, 0, ZERO, READ_ONLY_DENY), overwrite('601', 0, POSTER_ALLOW)]),
    ])
    const result = planPreset(input, req())
    expect(result.plan).toBeNull()
    expect(result.problems).toEqual(['Every selected channel already matches this preset.'])
    expect(result.stats).toEqual({ channels: 1, changed: 0, unchanged: 1, changes: 0 })
  })

  it('applies to a category the same way as to a text channel', () => {
    const { plan } = planPreset(guild([category('cat', 'Info')]), req({ channelIds: ['cat'] }))
    expect(plan!.changes).toHaveLength(2)
  })

  it('orders changes by the guild channel order, not the request order', () => {
    const input = guild([textChannel('c1', 'a'), textChannel('c2', 'b'), textChannel('c3', 'c')])
    const { plan } = planPreset(input, req({ channelIds: ['c3', 'c1', 'c2'], slots: { posters: [] } }))
    expect(plan!.changes.map((c) => c.channelId)).toEqual(['c1', 'c2', 'c3'])
  })
})

describe('planPreset: Private to roles', () => {
  const priv = (over: Partial<PresetRequest> = {}): PresetRequest => ({
    presetId: 'private-to-roles',
    slots: { allowed: ['601', '602'] },
    channelIds: ['c1'],
    ...over,
  })

  it('denies @everyone View and grants each allowed role the text permissions', () => {
    const { plan, stats } = planPreset(guild(), priv())
    expect(stats!.changes).toBe(3)
    expect(plan!.changes.map((c) => c.targetId)).toEqual(['601', '602', GUILD_ID])
    expect(plan!.changes[2]!.after[0]!.deny).toBe(P.ViewChannel.toString())
    expect(plan!.changes[0]!.after[0]!.allow).toBe((P.ViewChannel | P.SendMessages | P.ReadMessageHistory).toString())
  })

  it('uses voice permissions on voice channels and the union on categories', () => {
    const input = guild([voiceChannel('v1', 'Lounge'), category('cat', 'Staff')])
    const { plan } = planPreset(input, priv({ channelIds: ['v1', 'cat'], slots: { allowed: ['601'] } }))
    const allowOf = (channelId: string) => BigInt(plan!.changes.find((c) => c.channelId === channelId && c.targetId === '601')!.after[0]!.allow)
    expect(allowOf('v1')).toBe(P.ViewChannel | P.Connect | P.Speak)
    expect(allowOf('cat')).toBe(P.ViewChannel | P.SendMessages | P.ReadMessageHistory | P.Connect | P.Speak)
  })

  it('merges with an existing overwrite for an allowed role without dropping its other bits', () => {
    const input = guild([textChannel('c1', 'general', [overwrite('601', 0, P.AttachFiles, P.ViewChannel)])])
    const change = planPreset(input, priv({ slots: { allowed: ['601'] } })).plan!.changes.find((c) => c.targetId === '601')!
    expect(change.after[0]!.allow).toBe((P.AttachFiles | P.ViewChannel | P.SendMessages | P.ReadMessageHistory).toString())
    expect(change.after[0]!.deny).toBe('0')
  })
})

describe('planPreset: change order', () => {
  it('puts the @everyone change after every slot-role change in each channel, for both presets', () => {
    const input = guild([textChannel('c1', 'a'), textChannel('c2', 'b')])
    const requests: PresetRequest[] = [
      { presetId: 'read-only', slots: { posters: ['602', '601'] }, channelIds: ['c1', 'c2'] },
      { presetId: 'private-to-roles', slots: { allowed: ['602', '601'] }, channelIds: ['c1', 'c2'] },
    ]
    for (const request of requests) {
      const { plan } = planPreset(input, request)
      for (const channelId of ['c1', 'c2']) {
        const targets = plan!.changes.filter((c) => c.channelId === channelId).map((c) => c.targetId)
        expect(targets).toEqual(['601', '602', GUILD_ID])
      }
    }
  })
})

describe('planPreset: data that no longer matches the request', () => {
  it('reports an unknown preset, a deleted role, @everyone as a slot role, and a deleted channel without throwing', () => {
    expect(planPreset(guild(), req({ presetId: 'nope' as never })).problems).toEqual(['Unknown preset.'])
    expect(planPreset(guild(), req({ slots: { posters: ['999'] } })).problems).toEqual([
      'A role chosen for "Roles that can post" no longer exists.',
    ])
    expect(planPreset(guild(), req({ slots: { posters: [GUILD_ID] } })).problems).toEqual([
      `@everyone can't be chosen for "Roles that can post".`,
    ])
    expect(planPreset(guild(), req({ channelIds: ['c1', 'gone'] })).problems).toEqual([
      '1 selected channel no longer exists.',
    ])
    for (const result of [
      planPreset(guild(), req({ slots: { posters: ['999'] } })),
      planPreset(guild(), req({ channelIds: ['gone'] })),
    ]) {
      expect(result.plan).toBeNull()
    }
  })

  it('rejects a channel type the preset does not support', () => {
    const input = guild([voiceChannel('v1', 'Lounge')])
    const result = planPreset(input, req({ channelIds: ['v1'] }))
    expect(result.plan).toBeNull()
    expect(result.problems).toEqual(['#Lounge is not a channel type the "Read-only" preset supports.'])
  })

  it('returns a null plan with a problem when the plan would exceed the change cap', () => {
    const roles = Array.from({ length: 10 }, (_, i) => role(`70${i}`, `R${i}`, '0', 1))
    const channels = Array.from({ length: 10 }, (_, i) => textChannel(`c${i}`, `chan-${i}`))
    const input = makeInput({ roles: [everyoneRole(), botRole(), ...roles], channels })
    const result = planPreset(input, {
      presetId: 'read-only',
      slots: { posters: roles.map((r) => r.id) },
      channelIds: channels.map((c) => c.id),
    })
    expect(result.plan).toBeNull()
    expect(result.problems).toEqual([
      `This would make 110 changes, and the limit is ${MAX_PRESET_CHANGES}. Choose fewer channels or roles.`,
    ])
    expect(result.stats).toMatchObject({ channels: 10, changes: 110 })
  })
})

describe('planPreset: hash', () => {
  const input = () => guild([textChannel('c1', 'a'), textChannel('c2', 'b')])

  it('is stable for the same selection in a different request order', () => {
    const a = planPreset(input(), req({ channelIds: ['c1', 'c2'], slots: { posters: ['601', '602'] } })).plan!.hash
    const b = planPreset(input(), req({ channelIds: ['c2', 'c1'], slots: { posters: ['602', '601'] } })).plan!.hash
    expect(a).toBe(b)
  })

  it('changes when the preset, the slot roles, the channels, or a channel\'s state changes', () => {
    const base = planPreset(input(), req({ channelIds: ['c1'] })).plan!.hash
    expect(planPreset(input(), req({ channelIds: ['c1'], slots: { posters: ['602'] } })).plan!.hash).not.toBe(base)
    expect(planPreset(input(), req({ channelIds: ['c2'] })).plan!.hash).not.toBe(base)
    expect(
      planPreset(input(), { presetId: 'private-to-roles', slots: { allowed: ['601'] }, channelIds: ['c1'] }).plan!.hash,
    ).not.toBe(base)
    const changed = guild([textChannel('c1', 'a', [overwrite('602', 0, P.ViewChannel)]), textChannel('c2', 'b')])
    // c1 gains an unrelated overwrite: the plan's own changes are identical, so the hash must still follow the selection only.
    expect(planPreset(changed, req({ channelIds: ['c1'] })).plan!.hash).toBe(base)
    const different = guild([textChannel('c1', 'a', [overwrite(GUILD_ID, 0, P.AttachFiles)]), textChannel('c2', 'b')])
    expect(planPreset(different, req({ channelIds: ['c1'] })).plan!.hash).not.toBe(base)
  })

  it('does not depend on role names', () => {
    const renamed = makeInput({
      roles: [everyoneRole(), botRole(), role('601', 'Renamed', '0', 3)],
      channels: [textChannel('c1', 'a')],
    })
    const original = makeInput({
      roles: [everyoneRole(), botRole(), role('601', 'Staff', '0', 3)],
      channels: [textChannel('c1', 'a')],
    })
    expect(planPreset(renamed, req()).plan!.hash).toBe(planPreset(original, req()).plan!.hash)
  })
})
