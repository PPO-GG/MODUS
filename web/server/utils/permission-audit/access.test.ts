import { describe, expect, it } from 'vitest'
import { PERMISSION_BITS as P } from '../../../shared/discord-permissions'
import { MAX_ACCESS_CHANGES, type AccessEdit, type AccessRule } from '../../../shared/channel-access'
import {
  BOT_ROLE_ID,
  GUILD_ID,
  botRole,
  category,
  everyoneRole,
  forumChannel,
  makeInput,
  overwrite,
  role,
  textChannel,
  voiceChannel,
} from './fixtures'
import { isSyncedWith, planAccess } from './access'
import { simulatePlan } from './fixes'

const ZERO = BigInt(0)
const UNKNOWN_BIT = BigInt(1) << BigInt(60)
const TEXT_POST = P.SendMessages | P.SendMessagesInThreads | P.CreatePublicThreads | P.CreatePrivateThreads | P.AddReactions
const VOICE_POST = P.Connect | P.Speak
const V = P.ViewChannel

const OPEN: AccessRule = { see: { kind: 'everyone' }, post: { kind: 'everyone' } }
const READ_ONLY: AccessRule = { see: { kind: 'everyone' }, post: { kind: 'nobody' } }
const STAFF_ONLY: AccessRule = { see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'everyone' } }
const ANNOUNCE: AccessRule = { see: { kind: 'roles', roleIds: ['601', '602'] }, post: { kind: 'roles', roleIds: ['601'] } }

const guild = (channels = [textChannel('c1', 'general')]) =>
  makeInput({
    roles: [everyoneRole(), botRole(), role('601', 'Staff', '0', 3), role('602', 'Members', '0', 2), role('603', 'Muted', '0', 1)],
    channels,
  })
const edit = (channelId: string, rule: AccessRule): AccessEdit => ({ channelId, rule })

describe('isSyncedWith', () => {
  it('is true only when the overwrite lists are equal regardless of order', () => {
    const parent = category('cat', 'Staff', [overwrite(GUILD_ID, 0, ZERO, V), overwrite('601', 0, V)])
    expect(isSyncedWith(textChannel('c', 'x', [overwrite('601', 0, V), overwrite(GUILD_ID, 0, ZERO, V)], 'cat'), parent)).toBe(true)
    expect(isSyncedWith(textChannel('c', 'x', [overwrite(GUILD_ID, 0, ZERO, V)], 'cat'), parent)).toBe(false)
    expect(isSyncedWith(textChannel('c', 'x', [], 'cat'), category('e', 'Empty'))).toBe(true)
  })
})

describe('planAccess: reconciliation on one channel', () => {
  it('read-only on a fresh text channel denies the post set on @everyone only', () => {
    const { plan, problems, stats } = planAccess(guild(), [edit('c1', READ_ONLY)])
    expect(problems).toEqual([])
    expect(stats).toEqual({ channels: 1, cascaded: 0, changed: 1, unchanged: 0, changes: 1 })
    expect(plan!.findingId).toBe('access:1')
    expect(plan!.summary).toBe('Change who can see and post in 1 channel')
    expect(plan!.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(plan!.changes[0]).toMatchObject({ channelId: 'c1', op: 'set-overwrite', targetId: GUILD_ID, targetType: 0, before: [] })
    expect(plan!.changes[0]!.after[0]).toMatchObject({ allow: '0', deny: TEXT_POST.toString() })
  })

  it('private + posters: role grants first, then @everyone; posters get view + post bits', () => {
    const { plan } = planAccess(guild(), [edit('c1', ANNOUNCE)])
    expect(plan!.changes.map((c) => c.targetId)).toEqual(['601', '602', GUILD_ID])
    expect(plan!.changes[0]!.after[0]).toMatchObject({ allow: (V | TEXT_POST).toString(), deny: '0' })
    expect(plan!.changes[1]!.after[0]).toMatchObject({ allow: V.toString(), deny: '0' })
    expect(plan!.changes[2]!.after[0]).toMatchObject({ allow: '0', deny: (V | TEXT_POST).toString() })
  })

  it('voice channels use Connect/Speak', () => {
    const { plan } = planAccess(guild([voiceChannel('v1', 'Lounge')]), [edit('v1', { see: { kind: 'everyone' }, post: { kind: 'roles', roleIds: ['601'] } })])
    expect(plan!.changes.map((c) => c.targetId)).toEqual(['601', GUILD_ID])
    expect(plan!.changes[0]!.after[0]!.allow).toBe(VOICE_POST.toString())
    expect(plan!.changes[1]!.after[0]!.deny).toBe(VOICE_POST.toString())
  })

  it('a category manages the union of text and voice bits', () => {
    const { plan } = planAccess(guild([category('cat', 'Team')]), [edit('cat', READ_ONLY)])
    expect(plan!.changes[0]!.after[0]!.deny).toBe((TEXT_POST | VOICE_POST).toString())
  })

  it('preserves every unmanaged bit and never touches member overwrites', () => {
    const input = guild([
      textChannel('c1', 'general', [
        overwrite(GUILD_ID, 0, P.AttachFiles, P.EmbedLinks | UNKNOWN_BIT),
        overwrite('601', 0, P.ManageMessages | P.SendMessages, P.MentionEveryone),
        overwrite('900', 1, P.ManageRoles),
      ]),
    ])
    const { plan } = planAccess(input, [edit('c1', STAFF_ONLY)])
    expect(plan!.changes.map((c) => [c.targetId, c.targetType])).toEqual([['601', 0], [GUILD_ID, 0]])
    const staff = plan!.changes[0]!.after[0]!
    expect(staff.allow).toBe((P.ManageMessages | V).toString())      // SendMessages (managed) cleared, ManageMessages kept
    expect(staff.deny).toBe(P.MentionEveryone.toString())
    const everyone = plan!.changes[1]!.after[0]!
    expect(everyone.allow).toBe(P.AttachFiles.toString())
    expect(everyone.deny).toBe((P.EmbedLinks | UNKNOWN_BIT | V).toString())
  })

  it('the rule is the whole truth: other roles lose their managed bits; an all-zero overwrite is deleted (last)', () => {
    const input = guild([
      textChannel('c1', 'general', [
        overwrite(GUILD_ID, 0, ZERO, V),
        overwrite('601', 0, V),
        overwrite('602', 0, V),                         // will become empty → delete
        overwrite('603', 0, V | P.ManageMessages),      // keeps ManageMessages → set
      ]),
    ])
    const { plan } = planAccess(input, [edit('c1', STAFF_ONLY)])
    expect(plan!.changes.map((c) => [c.targetId, c.op])).toEqual([
      ['603', 'set-overwrite'],
      ['602', 'delete-overwrite'],
    ])
    expect(plan!.changes[0]!.after[0]!.allow).toBe(P.ManageMessages.toString())
    expect(plan!.changes[1]!.after).toEqual([])
  })

  it('opening a channel back up deletes the @everyone overwrite when nothing else is on it', () => {
    const input = guild([textChannel('c1', 'general', [overwrite(GUILD_ID, 0, ZERO, TEXT_POST)])])
    const { plan } = planAccess(input, [edit('c1', OPEN)])
    expect(plan!.changes).toHaveLength(1)
    expect(plan!.changes[0]).toMatchObject({ op: 'delete-overwrite', targetId: GUILD_ID })
  })

  it('a channel that already matches emits nothing and the whole plan is a blocker', () => {
    const input = guild([textChannel('c1', 'general', [overwrite(GUILD_ID, 0, ZERO, TEXT_POST)])])
    const { plan, problems, stats } = planAccess(input, [edit('c1', READ_ONLY)])
    expect(plan).toBeNull()
    expect(problems).toEqual(['Every edited channel already matches its rule.'])
    expect(stats).toEqual({ channels: 1, cascaded: 0, changed: 0, unchanged: 1, changes: 0 })
  })

  it('a role denied View under a see-roles rule gets the deny cleared', () => {
    const input = guild([textChannel('c1', 'general', [overwrite(GUILD_ID, 0, ZERO, V), overwrite('603', 0, ZERO, V)])])
    const { plan } = planAccess(input, [edit('c1', STAFF_ONLY)])
    expect(plan!.changes.map((c) => [c.targetId, c.op])).toEqual([['601', 'set-overwrite'], ['603', 'delete-overwrite']])
  })
})

describe('planAccess: cascade', () => {
  const world = () =>
    guild([
      category('cat', 'Team', [overwrite(GUILD_ID, 0, ZERO, V), overwrite('602', 0, V)]),
      textChannel('t1', 'chat', [overwrite('602', 0, V), overwrite(GUILD_ID, 0, ZERO, V)], 'cat'),   // synced (order differs)
      textChannel('t2', 'own', [overwrite(GUILD_ID, 0, ZERO, V)], 'cat'),                             // not synced
      voiceChannel('v1', 'Voice', [overwrite(GUILD_ID, 0, ZERO, V), overwrite('602', 0, V)], 'cat'),  // synced
      forumChannel('f1', 'Forum', [overwrite(GUILD_ID, 0, ZERO, V), overwrite('602', 0, V)], 'cat'),  // synced, unsupported kind
      textChannel('loose', 'loose'),
    ])

  it('replaces every synced child (any type) with the category result, byte for byte; skips unsynced children', () => {
    const { plan, stats } = planAccess(world(), [edit('cat', STAFF_ONLY)])
    const ops = plan!.changes.map((c) => [c.channelId, c.op, c.targetId ?? null])
    expect(ops).toEqual([
      ['cat', 'set-overwrite', '601'],
      ['cat', 'delete-overwrite', '602'],
      ['t1', 'replace-overwrites', null],
      ['v1', 'replace-overwrites', null],
      ['f1', 'replace-overwrites', null],
    ])
    const raw = (c: { after: Array<{ id: string; type: number; allow: string; deny: string }> }) => c.after.map((o) => [o.id, o.type, o.allow, o.deny])
    const expected = [[GUILD_ID, 0, '0', V.toString()], ['601', 0, V.toString(), '0']]
    expect(raw(plan!.changes[2]!)).toEqual(expected)
    expect(raw(plan!.changes[3]!)).toEqual(expected)
    expect(raw(plan!.changes[4]!)).toEqual(expected)
    expect(plan!.changes[2]!.before.map((o) => o.id)).toEqual([GUILD_ID, '602'])
    expect(stats).toEqual({ channels: 1, cascaded: 3, changed: 4, unchanged: 0, changes: 5 })
  })

  it('a child with its own edit is reconciled on its own, not cascaded', () => {
    const { plan, stats } = planAccess(world(), [edit('cat', STAFF_ONLY), edit('t1', READ_ONLY)])
    const t1 = plan!.changes.filter((c) => c.channelId === 't1')
    expect(t1.every((c) => c.op !== 'replace-overwrites')).toBe(true)
    expect(t1.map((c) => [c.targetId, c.op])).toEqual([['602', 'delete-overwrite'], [GUILD_ID, 'set-overwrite']])   // 602's View allow becomes empty (non-bot delete first); see: everyone clears the View deny
    expect(stats!.channels).toBe(2)
    expect(stats!.cascaded).toBe(2)
  })

  it('when the category already matches, synced children are counted but untouched', () => {
    const matching = { see: { kind: 'roles' as const, roleIds: ['602'] }, post: { kind: 'everyone' as const } }
    const { plan, problems, stats } = planAccess(world(), [edit('cat', matching)])
    expect(plan).toBeNull()
    expect(problems).toEqual(['Every edited channel already matches its rule.'])
    expect(stats).toEqual({ channels: 1, cascaded: 3, changed: 0, unchanged: 4, changes: 0 })
  })

  it('the hash changes when a child desyncs (so a stale preview is refused)', () => {
    const a = planAccess(world(), [edit('cat', STAFF_ONLY)]).plan!.hash
    const drifted = world()
    drifted.channels[1]!.permission_overwrites = [overwrite(GUILD_ID, 0, ZERO, V)]
    const b = planAccess(drifted, [edit('cat', STAFF_ONLY)]).plan!.hash
    expect(a).not.toBe(b)
  })

  it('an unchanged 0/0 role overwrite is kept in the cascade so the child stays synced', () => {
    const ows = () => [overwrite('603', 0), overwrite(GUILD_ID, 0, ZERO, V), overwrite('602', 0, V)]
    const input = guild([category('cat', 'Team', ows()), textChannel('t1', 'chat', ows(), 'cat')])
    const { plan } = planAccess(input, [edit('cat', READ_ONLY)])
    const replace = plan!.changes.find((c) => c.channelId === 't1')!
    expect(replace.op).toBe('replace-overwrites')
    expect(replace.after.map((o) => [o.id, o.type, o.allow, o.deny])).toContainEqual(['603', 0, '0', '0'])
    expect(plan!.changes.some((c) => c.targetId === '603')).toBe(false)
    const simulated = simulatePlan(input, plan!)
    const [cat, t1] = simulated.channels
    expect(isSyncedWith(t1!, cat!)).toBe(true)
  })
})

describe('planAccess: write order keeps the bot able to see the channel', () => {
  it('non-bot grants, non-bot deletes, then @everyone; a bot-role delete is last', () => {
    const input = guild([
      textChannel('c1', 'general', [overwrite(BOT_ROLE_ID, 0, V), overwrite('602', 0, V)]),
    ])
    const { plan } = planAccess(input, [edit('c1', STAFF_ONLY)])
    expect(plan!.changes.map((c) => [c.targetId, c.op])).toEqual([
      ['601', 'set-overwrite'],
      ['602', 'delete-overwrite'],
      [GUILD_ID, 'set-overwrite'],
      [BOT_ROLE_ID, 'delete-overwrite'],
    ])
  })

  it('a bot role keeping View is written before @everyone; one losing View after it', () => {
    const keeps = planAccess(guild([textChannel('c1', 'general', [overwrite('602', 0, V)])]), [
      edit('c1', { see: { kind: 'roles', roleIds: ['601', BOT_ROLE_ID] }, post: { kind: 'everyone' } }),
    ]).plan!
    expect(keeps.changes.map((c) => [c.targetId, c.op])).toEqual([
      ['601', 'set-overwrite'],
      [BOT_ROLE_ID, 'set-overwrite'],
      ['602', 'delete-overwrite'],
      [GUILD_ID, 'set-overwrite'],
    ])
    const loses = planAccess(guild([textChannel('c1', 'general', [overwrite(BOT_ROLE_ID, 0, V | P.ManageMessages)])]), [
      edit('c1', STAFF_ONLY),
    ]).plan!
    expect(loses.changes.map((c) => [c.targetId, c.op])).toEqual([
      ['601', 'set-overwrite'],
      [GUILD_ID, 'set-overwrite'],
      [BOT_ROLE_ID, 'set-overwrite'],
    ])
  })
})

describe('planAccess: hash and ordering', () => {
  it('is stable across request order and role order, and changes with any rule change', () => {
    const input = guild([textChannel('c1', 'a'), textChannel('c2', 'b')])
    const a = planAccess(input, [edit('c1', ANNOUNCE), edit('c2', READ_ONLY)]).plan!
    const b = planAccess(input, [edit('c2', READ_ONLY), edit('c1', { see: { kind: 'roles', roleIds: ['602', '601'] }, post: { kind: 'roles', roleIds: ['601'] } })]).plan!
    expect(a.hash).toBe(b.hash)
    expect(a.changes.map((c) => c.channelId)).toEqual(['c1', 'c1', 'c1', 'c2'])
    const c = planAccess(input, [edit('c1', STAFF_ONLY), edit('c2', READ_ONLY)]).plan!
    expect(c.hash).not.toBe(a.hash)
  })
})

describe('planAccess: problems', () => {
  it('reports missing channels, unsupported kinds, missing roles, @everyone and subset violations', () => {
    const input = guild([textChannel('c1', 'general'), forumChannel('f1', 'forum')])
    expect(planAccess(input, [edit('ghost', OPEN)]).problems).toEqual(['1 edited channel no longer exists.'])
    expect(planAccess(input, [edit('f1', OPEN)]).problems).toEqual(['#forum is not a channel type Channel Access supports.'])
    expect(planAccess(input, [edit('c1', { see: { kind: 'roles', roleIds: ['999'] }, post: { kind: 'everyone' } })]).problems)
      .toEqual(['A role chosen for #general no longer exists.'])
    expect(planAccess(input, [edit('c1', { see: { kind: 'roles', roleIds: [GUILD_ID] }, post: { kind: 'everyone' } })]).problems)
      .toEqual(["@everyone can't be used as a role in #general."])
    expect(planAccess(input, [edit('c1', { see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'roles', roleIds: ['602'] } })]).problems)
      .toEqual(['In #general, roles that can post must also be able to see it.'])
  })

  it('refuses a plan above the change cap', () => {
    const channels = Array.from({ length: 60 }, (_, i) => textChannel(`c${i}`, `c${i}`))
    const input = guild(channels)
    const edits = channels.map((c) => edit(c.id, ANNOUNCE))   // 3 writes each = 180; raise with more roles
    const big = channels.map((c) => edit(c.id, { see: { kind: 'roles', roleIds: ['601', '602', '603', BOT_ROLE_ID] }, post: { kind: 'everyone' } })) // 5 each = 300
    expect(planAccess(input, edits).plan).not.toBeNull()
    const { plan, problems } = planAccess(input, big)
    expect(plan).toBeNull()
    expect(problems[0]).toBe(`This would make 300 changes, and the limit is ${MAX_ACCESS_CHANGES}. Edit fewer channels at a time.`)
  })
})
