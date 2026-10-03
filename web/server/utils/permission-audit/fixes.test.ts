import { describe, expect, it } from 'vitest'
import { PERMISSION_BITS as P } from '../../../shared/discord-permissions'
import {
  BOT_ID,
  BOT_ROLE_ID,
  GUILD_ID,
  bits,
  botRole,
  category,
  everyoneRole,
  makeInput,
  overwrite,
  role,
  textChannel,
} from './fixtures'
import { planFix, simulatePlan } from './fixes'

const ZERO = BigInt(0)
const UNKNOWN_BIT = BigInt(1) << BigInt(60)

describe('planFix: @everyone management / mention overwrites', () => {
  it('removes the flagged bits and keeps the rest of the overwrite as a set', () => {
    const input = makeInput({
      channels: [
        textChannel('c1', 'general', [
          overwrite(GUILD_ID, 0, P.ManageChannels | P.ManageWebhooks | P.SendMessages, P.AttachFiles),
        ]),
      ],
    })
    const plan = planFix(input, 'everyone-channel-manage:c1')!
    expect(plan.findingId).toBe('everyone-channel-manage:c1')
    expect(plan.changes).toHaveLength(1)
    const change = plan.changes[0]!
    expect(change).toMatchObject({ channelId: 'c1', channelName: 'general', op: 'set-overwrite', targetId: GUILD_ID, targetType: 0 })
    expect(change.before[0]).toMatchObject({ id: GUILD_ID, label: '@everyone', allow: (P.ManageChannels | P.ManageWebhooks | P.SendMessages).toString() })
    expect(change.after).toHaveLength(1)
    expect(change.after[0]!.allow).toBe(P.SendMessages.toString())
    expect(change.after[0]!.deny).toBe(P.AttachFiles.toString())
    expect(change.after[0]!.allowNames).toEqual(['Send Messages'])
    expect(plan.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(plan.summary).toContain('#general')
  })

  it('deletes the overwrite when nothing is left in it', () => {
    const input = makeInput({
      channels: [textChannel('c1', 'general', [overwrite(GUILD_ID, 0, P.MentionEveryone)])],
    })
    const change = planFix(input, 'everyone-channel-mention:c1')!.changes[0]!
    expect(change.op).toBe('delete-overwrite')
    expect(change.targetId).toBe(GUILD_ID)
    expect(change.after).toEqual([])
  })

  it('preserves bits it has no name for', () => {
    const input = makeInput({
      channels: [textChannel('c1', 'general', [overwrite(GUILD_ID, 0, P.ManageChannels | UNKNOWN_BIT)])],
    })
    const change = planFix(input, 'everyone-channel-manage:c1')!.changes[0]!
    expect(change.op).toBe('set-overwrite')
    expect(change.after[0]!.allow).toBe(UNKNOWN_BIT.toString())
  })

  it('only clears the bits of the rule it was asked about', () => {
    const input = makeInput({
      channels: [textChannel('c1', 'general', [overwrite(GUILD_ID, 0, P.ManageChannels | P.MentionEveryone)])],
    })
    const change = planFix(input, 'everyone-channel-mention:c1')!.changes[0]!
    expect(change.after[0]!.allow).toBe(P.ManageChannels.toString())
  })
})

describe('planFix: sync a child with its category', () => {
  const exposed = () =>
    makeInput({
      channels: [
        category('cat', 'Staff', [overwrite(GUILD_ID, 0, ZERO, P.ViewChannel), overwrite('77', 0, P.ViewChannel)]),
        textChannel('child', 'mod-chat', [overwrite(GUILD_ID, 0, P.ViewChannel)], 'cat'),
      ],
    })

  it("replaces the child's overwrites with a copy of the category's", () => {
    const plan = planFix(exposed(), 'child-exposed:child')!
    const change = plan.changes[0]!
    expect(change).toMatchObject({ channelId: 'child', op: 'replace-overwrites' })
    expect(change.before.map((o) => [o.id, o.allow, o.deny])).toEqual([[GUILD_ID, P.ViewChannel.toString(), '0']])
    expect(change.after.map((o) => o.id).sort()).toEqual(['100', '77'])
    expect(change.after.find((o) => o.id === GUILD_ID)!.deny).toBe(P.ViewChannel.toString())
    expect(plan.summary).toContain('#mod-chat')
  })

  it('returns null when the finding does not exist (already synced)', () => {
    const synced = makeInput({
      channels: [
        category('cat', 'Staff', [overwrite(GUILD_ID, 0, ZERO, P.ViewChannel)]),
        textChannel('child', 'mod-chat', [overwrite(GUILD_ID, 0, ZERO, P.ViewChannel)], 'cat'),
      ],
    })
    expect(planFix(synced, 'child-exposed:child')).toBeNull()
  })
})

describe('planFix: give the bot the permissions it is missing in a channel', () => {
  const base = () =>
    makeInput({
      roles: [everyoneRole(), botRole(bits(P.ViewChannel, P.SendMessages, P.EmbedLinks))],
      channels: [textChannel('c1', 'audit', [overwrite(GUILD_ID, 0, ZERO, P.ViewChannel | P.SendMessages)])],
      modules: [{ name: 'logging', enabled: true, settings: { auditChannelId: 'c1' } }],
    })

  it("creates an overwrite for the bot's user allowing exactly the missing permissions", () => {
    const plan = planFix(base(), 'channel-perms:logging:c1')!
    const change = plan.changes[0]!
    expect(change).toMatchObject({ channelId: 'c1', op: 'set-overwrite', targetId: BOT_ID, targetType: 1 })
    expect(change.before).toEqual([])
    expect(change.after[0]).toMatchObject({ id: BOT_ID, type: 1, label: 'the bot', deny: '0' })
    expect(change.after[0]!.allow).toBe((P.ViewChannel | P.SendMessages).toString())
  })

  it('merges into an existing bot overwrite and clears matching denies', () => {
    const input = base()
    input.channels = [
      textChannel('c1', 'audit', [
        overwrite(GUILD_ID, 0, ZERO, P.ViewChannel | P.SendMessages),
        overwrite(BOT_ID, 1, P.AttachFiles, P.SendMessages | P.MentionEveryone),
      ]),
    ]
    const change = planFix(input, 'channel-perms:logging:c1')!.changes[0]!
    expect(change.before[0]!.deny).toBe((P.SendMessages | P.MentionEveryone).toString())
    expect(change.after[0]!.allow).toBe((P.AttachFiles | P.ViewChannel | P.SendMessages).toString())
    expect(change.after[0]!.deny).toBe(P.MentionEveryone.toString())
  })

  it('returns null when the module no longer references the channel', () => {
    const input = base()
    input.modules = [{ name: 'logging', enabled: true, settings: { auditChannelId: 'other' } }]
    expect(planFix(input, 'channel-perms:logging:c1')).toBeNull()
  })
})

describe('planFix: unsupported or stale findings', () => {
  it('returns null for unknown ids and for findings that are not fixable', () => {
    const input = makeInput({ roles: [everyoneRole(bits(P.BanMembers)), botRole()] })
    expect(planFix(input, 'nope:1')).toBeNull()
    expect(planFix(input, 'everyone-critical:100')).toBeNull()
    expect(planFix(input, '')).toBeNull()
  })

  it('returns null when the channel is not in the guild any more', () => {
    expect(planFix(makeInput(), 'everyone-channel-manage:gone')).toBeNull()
  })

  it('produces the same hash for the same state and a different hash when anything changes', () => {
    const make = (allow: bigint) =>
      makeInput({ channels: [textChannel('c1', 'general', [overwrite(GUILD_ID, 0, allow)])] })
    const a = planFix(make(P.ManageChannels | P.SendMessages), 'everyone-channel-manage:c1')!.hash
    const b = planFix(make(P.ManageChannels | P.SendMessages), 'everyone-channel-manage:c1')!.hash
    const c = planFix(make(P.ManageChannels | P.SendMessages | P.AttachFiles), 'everyone-channel-manage:c1')!.hash
    expect(a).toBe(b)
    expect(a).not.toBe(c)
  })

  it('does not change the hash when only a role name changes (labels are display-only)', () => {
    const make = (name: string) =>
      makeInput({
        roles: [everyoneRole(), botRole(), role('77', name, '0', 3)],
        channels: [textChannel('c1', 'general', [overwrite(GUILD_ID, 0, P.ManageChannels), overwrite('77', 0, P.ViewChannel)])],
      })
    // A role overwrite is not touched by this fix, so only @everyone's state is in the plan.
    expect(planFix(make('A'), 'everyone-channel-manage:c1')!.hash).toBe(
      planFix(make('B'), 'everyone-channel-manage:c1')!.hash,
    )
  })
})

describe('simulatePlan', () => {
  const owOf = (input: ReturnType<typeof makeInput>, id: string) =>
    input.channels.find((c) => c.id === id)!.permission_overwrites!.map((o) => [o.id, o.type, o.allow, o.deny])

  it('applies a set-overwrite by replacing the matching overwrite in place', () => {
    const input = makeInput({
      channels: [
        textChannel('c1', 'general', [overwrite(GUILD_ID, 0, P.ManageChannels | P.SendMessages), overwrite('77', 0, P.ViewChannel)]),
        textChannel('c2', 'other', [overwrite(GUILD_ID, 0, P.ManageChannels)]),
      ],
    })
    const plan = planFix(input, 'everyone-channel-manage:c1')!
    const simulated = simulatePlan(input, plan)
    expect(owOf(simulated, 'c1')).toEqual([
      [GUILD_ID, 0, P.SendMessages.toString(), '0'],
      ['77', 0, P.ViewChannel.toString(), '0'],
    ])
    // Other channels are untouched, and the input is not mutated.
    expect(owOf(simulated, 'c2')).toEqual(owOf(input, 'c2'))
    expect(owOf(input, 'c1')[0]).toEqual([GUILD_ID, 0, (P.ManageChannels | P.SendMessages).toString(), '0'])
  })

  it('inserts a set-overwrite that did not exist before', () => {
    const input = makeInput({
      roles: [everyoneRole(), botRole(bits(P.ViewChannel, P.SendMessages, P.EmbedLinks))],
      channels: [textChannel('c1', 'audit', [overwrite(GUILD_ID, 0, ZERO, P.ViewChannel | P.SendMessages)])],
      modules: [{ name: 'logging', enabled: true, settings: { auditChannelId: 'c1' } }],
    })
    const simulated = simulatePlan(input, planFix(input, 'channel-perms:logging:c1')!)
    expect(owOf(simulated, 'c1')).toContainEqual([BOT_ID, 1, (P.ViewChannel | P.SendMessages).toString(), '0'])
    expect(owOf(simulated, 'c1')).toHaveLength(2)
  })

  it('removes the overwrite for a delete-overwrite', () => {
    const input = makeInput({
      channels: [textChannel('c1', 'general', [overwrite(GUILD_ID, 0, P.MentionEveryone), overwrite('77', 0, P.ViewChannel)])],
    })
    const simulated = simulatePlan(input, planFix(input, 'everyone-channel-mention:c1')!)
    expect(owOf(simulated, 'c1')).toEqual([['77', 0, P.ViewChannel.toString(), '0']])
  })

  it("replaces the whole list for a replace-overwrites", () => {
    const input = makeInput({
      channels: [
        category('cat', 'Staff', [overwrite(GUILD_ID, 0, ZERO, P.ViewChannel), overwrite('77', 0, P.ViewChannel)]),
        textChannel('child', 'mod-chat', [overwrite(GUILD_ID, 0, P.ViewChannel), overwrite(BOT_ID, 1, P.ViewChannel)], 'cat'),
      ],
    })
    const simulated = simulatePlan(input, planFix(input, 'child-exposed:child')!)
    expect(owOf(simulated, 'child').map((o) => o[0]).sort()).toEqual(['100', '77'])
    expect(owOf(simulated, 'child').find((o) => o[0] === GUILD_ID)).toEqual([GUILD_ID, 0, '0', P.ViewChannel.toString()])
  })
})
