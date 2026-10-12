import { describe, expect, it } from 'vitest'
import { PERMISSION_BITS as P, type OverwriteLike, type RoleLike } from './discord-permissions'
import {
  MAX_ACCESS_EDITS,
  MAX_ROLES_PER_RULE,
  SEE_BITS,
  channelKind,
  classifyChannel,
  describePost,
  describeSee,
  isAdminRole,
  managedBits,
  postBits,
  validateAccessRequest,
  validateAccessRule,
} from './channel-access'

const G = '100'
const ZERO = BigInt(0)
const TEXT_POST = P.SendMessages | P.SendMessagesInThreads | P.CreatePublicThreads | P.CreatePrivateThreads | P.AddReactions
const VOICE_POST = P.Connect | P.Speak
const ow = (id: string, type: 0 | 1, allow: bigint = ZERO, deny: bigint = ZERO): OverwriteLike => ({
  id, type, allow: allow.toString(), deny: deny.toString(),
})
const roles: RoleLike[] = [
  { id: G, name: '@everyone', position: 0, permissions: (P.ViewChannel | P.SendMessages).toString() },
  { id: '601', name: 'Staff', position: 3, permissions: '0' },
  { id: '602', name: 'Members', position: 2, permissions: '0' },
  { id: '603', name: 'Muted', position: 1, permissions: '0' },
  { id: '801', name: 'Admins', position: 4, permissions: P.Administrator.toString() },
]

describe('bits', () => {
  it('maps channel types to kinds', () => {
    expect(channelKind(0)).toBe('text')
    expect(channelKind(5)).toBe('text')
    expect(channelKind(2)).toBe('voice')
    expect(channelKind(4)).toBe('category')
    expect(channelKind(15)).toBeNull()
    expect(channelKind(13)).toBeNull()
  })

  it('post bits per kind; category is the union; managed = see | post', () => {
    expect(postBits('text')).toBe(TEXT_POST)
    expect(postBits('voice')).toBe(VOICE_POST)
    expect(postBits('category')).toBe(TEXT_POST | VOICE_POST)
    expect(SEE_BITS).toBe(P.ViewChannel)
    expect(managedBits('text')).toBe(P.ViewChannel | TEXT_POST)
  })

  it('isAdminRole reads the Administrator bit', () => {
    expect(isAdminRole(roles[4]!)).toBe(true)
    expect(isAdminRole(roles[1]!)).toBe(false)
  })
})

describe('classifyChannel', () => {
  it('no overwrites → everyone sees, everyone posts', () => {
    expect(classifyChannel([], 'text', G, roles)).toEqual({
      rule: { see: { kind: 'everyone' }, post: { kind: 'everyone' } },
      see: { kind: 'everyone' },
      post: { kind: 'everyone' },
      seeSummary: 'Everyone',
      postSummary: 'Everyone who can see',
      memberOverrides: 0,
    })
  })

  it('private to roles: @everyone denied View, roles allowed View', () => {
    const c = classifyChannel(
      [ow(G, 0, ZERO, P.ViewChannel), ow('601', 0, P.ViewChannel), ow('602', 0, P.ViewChannel | P.ManageMessages)],
      'text', G, roles,
    )
    expect(c.rule).toEqual({ see: { kind: 'roles', roleIds: ['601', '602'] }, post: { kind: 'everyone' } })
    expect(c.seeSummary).toBe('Only Staff, Members')
  })

  it('read-only: @everyone denied the full post set with no posters → nobody', () => {
    const c = classifyChannel([ow(G, 0, ZERO, TEXT_POST)], 'text', G, roles)
    expect(c.rule).toEqual({ see: { kind: 'everyone' }, post: { kind: 'nobody' } })
    expect(c.postSummary).toBe('Read-only')
  })

  it('posters: roles allowed the full post set', () => {
    const c = classifyChannel([ow(G, 0, ZERO, TEXT_POST), ow('601', 0, TEXT_POST)], 'text', G, roles)
    expect(c.rule!.post).toEqual({ kind: 'roles', roleIds: ['601'] })
    expect(c.postSummary).toBe('Only Staff')
  })

  it('accepts at least the kind\'s bits: a text child carrying the category union still classifies', () => {
    const union = TEXT_POST | VOICE_POST
    const c = classifyChannel([ow(G, 0, ZERO, P.ViewChannel | union), ow('601', 0, P.ViewChannel | union)], 'text', G, roles)
    expect(c.rule).toEqual({ see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'roles', roleIds: ['601'] } })
  })

  it('voice uses Connect/Speak', () => {
    const c = classifyChannel([ow(G, 0, ZERO, VOICE_POST), ow('601', 0, VOICE_POST)], 'voice', G, roles)
    expect(c.rule!.post).toEqual({ kind: 'roles', roleIds: ['601'] })
  })

  it('Custom: a role denied View while everyone sees ("everyone except")', () => {
    const c = classifyChannel([ow('603', 0, ZERO, P.ViewChannel)], 'text', G, roles)
    expect(c).toMatchObject({ rule: null, see: null, post: { kind: 'everyone' } })
    expect(c.seeSummary).toBe('Everyone except Muted')
    expect(c.postSummary).toBe('Everyone who can see')
  })

  it('Custom: @everyone denies only part of the post set', () => {
    const c = classifyChannel([ow(G, 0, ZERO, P.SendMessages)], 'text', G, roles)
    expect(c).toMatchObject({ rule: null, see: { kind: 'everyone' }, post: null })
    expect(c.postSummary).toBe('Partly restricted')
  })

  it('Custom: private to a role with a partial post deny keeps its known visibility', () => {
    const c = classifyChannel([ow(G, 0, ZERO, P.ViewChannel | P.SendMessages), ow('601', 0, P.ViewChannel)], 'text', G, roles)
    expect(c).toMatchObject({ rule: null, see: { kind: 'roles', roleIds: ['601'] }, post: null })
    expect(c.seeSummary).toBe('Only Staff')
    expect(c.postSummary).toBe('Partly restricted')
  })

  it('Custom: a role allowed only some post bits is not a poster', () => {
    const c = classifyChannel([ow(G, 0, ZERO, TEXT_POST), ow('601', 0, P.SendMessages)], 'text', G, roles)
    expect(c).toMatchObject({ rule: null, see: { kind: 'everyone' }, post: null })
    expect(c.postSummary).toBe('Partly restricted')
  })

  it('Custom: a role denied a post bit while everyone posts', () => {
    const c = classifyChannel([ow('603', 0, ZERO, P.SendMessages)], 'text', G, roles)
    expect(c).toMatchObject({ rule: null, see: { kind: 'everyone' }, post: null })
    expect(c.postSummary).toBe('Everyone except Muted')
  })

  it('Custom: a poster that cannot see the channel', () => {
    const c = classifyChannel(
      [ow(G, 0, ZERO, P.ViewChannel | TEXT_POST), ow('601', 0, P.ViewChannel), ow('602', 0, TEXT_POST)],
      'text', G, roles,
    )
    expect(c).toMatchObject({ rule: null, see: { kind: 'roles', roleIds: ['601'] }, post: null })
    expect(c.postSummary).toContain("can't see")
  })

  it('ignores member overwrites and counts them', () => {
    const c = classifyChannel([ow('900', 1, ZERO, P.ViewChannel), ow('901', 1, P.ManageRoles)], 'text', G, roles)
    expect(c.rule).toEqual({ see: { kind: 'everyone' }, post: { kind: 'everyone' } })
    expect(c.memberOverrides).toBe(2)
  })

  it('unknown role ids are labelled by id', () => {
    const c = classifyChannel([ow(G, 0, ZERO, P.ViewChannel), ow('999', 0, P.ViewChannel)], 'text', G, roles)
    expect(c.seeSummary).toBe('Only role 999')
  })
})

describe('describeSee / describePost', () => {
  it('wording', () => {
    expect(describeSee({ kind: 'everyone' }, roles)).toBe('Everyone')
    expect(describeSee({ kind: 'roles', roleIds: [] }, roles)).toBe('Nobody')
    expect(describeSee({ kind: 'roles', roleIds: ['601'] }, roles)).toBe('Only Staff')
    expect(describePost({ kind: 'everyone' }, roles)).toBe('Everyone who can see')
    expect(describePost({ kind: 'nobody' }, roles)).toBe('Read-only')
    expect(describePost({ kind: 'roles', roleIds: ['601', '602'] }, roles)).toBe('Only Staff, Members')
  })
})

describe('validateAccessRule', () => {
  const ok = (raw: unknown) => {
    const r = validateAccessRule(raw, G)
    expect(r.ok).toBe(true)
    return (r as { ok: true; rule: unknown }).rule
  }
  const bad = (raw: unknown) => {
    const r = validateAccessRule(raw, G)
    expect(r.ok).toBe(false)
    return (r as { ok: false; error: string }).error
  }

  it('accepts the three shapes and dedupes + sorts role ids', () => {
    expect(ok({ see: { kind: 'everyone' }, post: { kind: 'everyone' } })).toEqual({ see: { kind: 'everyone' }, post: { kind: 'everyone' } })
    expect(ok({ see: { kind: 'roles', roleIds: ['602', '601', '602'] }, post: { kind: 'nobody' } })).toEqual({
      see: { kind: 'roles', roleIds: ['601', '602'] }, post: { kind: 'nobody' },
    })
    expect(ok({ see: { kind: 'roles', roleIds: ['601', '602'] }, post: { kind: 'roles', roleIds: ['601'] } })).toEqual({
      see: { kind: 'roles', roleIds: ['601', '602'] }, post: { kind: 'roles', roleIds: ['601'] },
    })
  })

  it('rejects bad shapes', () => {
    expect(bad(null)).toBe('Invalid rule.')
    expect(bad({ see: { kind: 'nobody' }, post: { kind: 'everyone' } })).toBe('Invalid "Who can see" choice.')
    expect(bad({ see: { kind: 'everyone' }, post: { kind: 'maybe' } })).toBe('Invalid "Who can post" choice.')
    expect(bad({ see: { kind: 'roles', roleIds: [] }, post: { kind: 'everyone' } })).toBe('Choose at least one role for "Who can see".')
    expect(bad({ see: { kind: 'roles', roleIds: ['abc'] }, post: { kind: 'everyone' } })).toBe('Invalid roles for "Who can see".')
    expect(bad({ see: { kind: 'roles', roleIds: [G] }, post: { kind: 'everyone' } })).toBe('@everyone can\'t be chosen for "Who can see".')
    const many = Array.from({ length: MAX_ROLES_PER_RULE + 1 }, (_, i) => String(1000 + i))
    expect(bad({ see: { kind: 'roles', roleIds: many }, post: { kind: 'everyone' } })).toBe(`Choose at most ${MAX_ROLES_PER_RULE} roles for "Who can see".`)
  })

  it('posters must be a subset of seers when see is roles', () => {
    expect(bad({ see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'roles', roleIds: ['602'] } })).toBe(
      'Roles that can post must also be able to see the channel.',
    )
    expect(ok({ see: { kind: 'everyone' }, post: { kind: 'roles', roleIds: ['602'] } })).toBeTruthy()
  })
})

describe('validateAccessRequest', () => {
  const rule = { see: { kind: 'everyone' }, post: { kind: 'nobody' } }

  it('accepts a well-formed body and returns typed edits', () => {
    const r = validateAccessRequest({ guild_id: G, edits: [{ channel_id: '1', rule }, { channel_id: '2', rule }] })
    expect(r).toEqual({ ok: true, guildId: G, edits: [
      { channelId: '1', rule: { see: { kind: 'everyone' }, post: { kind: 'nobody' } } },
      { channelId: '2', rule: { see: { kind: 'everyone' }, post: { kind: 'nobody' } } },
    ] })
  })

  it('rejects bad bodies', () => {
    const err = (b: unknown) => (validateAccessRequest(b) as { ok: false; error: string }).error
    expect(err(null)).toBe('Invalid request.')
    expect(err({ guild_id: 'x', edits: [] })).toBe('Missing or invalid guild_id.')
    expect(err({ guild_id: G, edits: [] })).toBe('Edit at least one channel.')
    expect(err({ guild_id: G, edits: 'nope' })).toBe('Edit at least one channel.')
    expect(err({ guild_id: G, edits: Array.from({ length: MAX_ACCESS_EDITS + 1 }, (_, i) => ({ channel_id: String(i + 1), rule })) }))
      .toBe(`Edit at most ${MAX_ACCESS_EDITS} channels at a time.`)
    expect(err({ guild_id: G, edits: [{ channel_id: 'abc', rule }] })).toBe('Invalid channel id.')
    expect(err({ guild_id: G, edits: [{ channel_id: '1', rule }, { channel_id: '1', rule }] })).toBe('A channel appears more than once.')
    expect(err({ guild_id: G, edits: [{ channel_id: '1', rule: { see: { kind: 'roles', roleIds: [G] }, post: { kind: 'everyone' } } }] }))
      .toBe('@everyone can\'t be chosen for "Who can see".')
  })
})
