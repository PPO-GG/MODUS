import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_BITS as P } from '../../shared/discord-permissions'
import type { AccessEdit, AccessRule } from '../../shared/channel-access'
import { resetBotUserIdCache } from './permission-audit-data'
import type { FixDeps } from './permission-audit-fix'
import { applyAccess, buildAccessState, loadAccessState, previewAccess } from './permission-access'
import { planAccess } from './permission-audit/access'
import { category, everyoneRole, makeInput, overwrite, role, textChannel, GUILD_ID } from './permission-audit/fixtures'

const G = '12345'
const BOT = '900'
const USER = '700'
const ZERO = BigInt(0)
const V = P.ViewChannel
const TEXT_POST = P.SendMessages | P.SendMessagesInThreads | P.CreatePublicThreads | P.CreatePrivateThreads | P.AddReactions
const bits = (...flags: bigint[]) => flags.reduce((a, b) => a | b, ZERO).toString()
const BOT_ALL = bits(
  V, P.SendMessages, P.EmbedLinks, P.ManageRoles, P.ManageChannels, P.ReadMessageHistory, P.AddReactions,
  P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads, P.Connect, P.Speak,
)

interface World {
  userRolePerms?: string
  botRolePerms?: string
  channels?: unknown[]
  configRows?: Array<{ moduleName: string; enabled: boolean; settings: string }>
}

function makeWorld(w: World = {}) {
  const roles = [
    { id: G, name: '@everyone', position: 0, permissions: bits(V, P.SendMessages), managed: false },
    { id: '901', name: 'MODUS', position: 5, permissions: w.botRolePerms ?? BOT_ALL, managed: true },
    { id: '801', name: 'Admins', position: 4, permissions: w.userRolePerms ?? bits(P.ManageGuild), managed: false },
    { id: '601', name: 'Staff', position: 3, permissions: '0', managed: false },
    { id: '602', name: 'Members', position: 2, permissions: '0', managed: false },
  ]
  const channels = w.channels ?? [
    { id: 'cat', name: 'Team', type: 4, position: 0, parent_id: null, permission_overwrites: [] },
    { id: 'c1', name: 'general', type: 0, position: 1, parent_id: 'cat', permission_overwrites: [] },
    { id: 'c2', name: 'rules', type: 0, position: 2, parent_id: null, permission_overwrites: [{ id: G, type: 0, allow: '0', deny: TEXT_POST.toString() }] },
    { id: 'f1', name: 'forum', type: 15, position: 3, parent_id: null, permission_overwrites: [] },
  ]
  const get = vi.fn(async (url: string) => {
    if (url.endsWith('/users/@me')) return { id: BOT }
    if (url.endsWith('/roles')) return roles
    if (url.endsWith('/channels')) return channels
    if (url.endsWith(`/members/${BOT}`)) return { roles: ['901'] }
    if (url.endsWith(`/members/${USER}`)) return { roles: ['801'] }
    if (url.endsWith(`/guilds/${G}`)) return { owner_id: '111' }
    throw new Error(`unexpected url ${url}`)
  })
  return { get, configRows: w.configRows ?? [] }
}

function makeDeps(world: ReturnType<typeof makeWorld>, over: Partial<FixDeps> = {}) {
  const request = vi.fn(async () => undefined)
  const logs = { log: vi.fn(async () => undefined) }
  return {
    botToken: 'SECRET-TOKEN',
    get: world.get,
    request,
    configs: { listByGuild: vi.fn(async () => world.configRows) },
    logs,
    ...over,
  } as unknown as FixDeps & { request: ReturnType<typeof vi.fn>; logs: { log: ReturnType<typeof vi.fn> } }
}

const ctx = { guildId: G, userId: USER }
const STAFF_ONLY: AccessRule = { see: { kind: 'roles', roleIds: ['601', '901'] }, post: { kind: 'everyone' } }
const edit = (channelId: string, rule: AccessRule): AccessEdit => ({ channelId, rule })

beforeEach(() => resetBotUserIdCache())

describe('buildAccessState', () => {
  it('classifies every channel, flags admins, excludes @everyone from roles, reports sync and the bot', () => {
    const input = makeInput({
      roles: [everyoneRole(), role('901', 'MODUS', bits(V, P.ManageRoles), 5, { managed: true }), role('801', 'Admins', P.Administrator.toString(), 4), role('601', 'Staff', '0', 3)],
      bot: { userId: '900', roleIds: ['901'] },
      channels: [
        { ...category('cat', 'Team', [overwrite(GUILD_ID, 0, ZERO, V), overwrite('601', 0, V)]), position: 0 },
        { ...textChannel('c1', 'chat', [overwrite('601', 0, V), overwrite(GUILD_ID, 0, ZERO, V)], 'cat'), position: 1 },
        { ...textChannel('c2', 'own', [overwrite(GUILD_ID, 0, ZERO, TEXT_POST), overwrite('900', 1, P.ManageRoles)], 'cat'), position: 2 },
        { ...textChannel('c3', 'loose'), position: 3 },
        { id: 'f1', name: 'forum', type: 15, parent_id: null, permission_overwrites: [], position: 4 },
      ],
    })
    const state = buildAccessState(input)
    expect(state.roles.map((r) => [r.id, r.admin])).toEqual([['901', false], ['801', true], ['601', false]])
    expect(state.botTopPosition).toBe(5)
    expect(state.botRoleIds).toEqual(['901'])
    expect(state.botAdmin).toBe(false)
    const by = Object.fromEntries(state.channels.map((c) => [c.id, c]))
    expect(by.cat).toMatchObject({ kind: 'category', parentId: null, position: 0, syncedWithParent: null, rule: { see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'everyone' } } })
    expect(by.c1).toMatchObject({ kind: 'text', parentId: 'cat', syncedWithParent: true, seeSummary: 'Only Staff' })
    expect(by.c2).toMatchObject({ syncedWithParent: false, memberOverrides: 1, rule: { see: { kind: 'everyone' }, post: { kind: 'nobody' } }, postSummary: 'Read-only' })
    expect(by.c3).toMatchObject({ syncedWithParent: null, rule: { see: { kind: 'everyone' }, post: { kind: 'everyone' } } })
    expect(by.f1).toMatchObject({ kind: null, seeSummary: 'Everyone' })
    expect(by.c3).toMatchObject({ see: { kind: 'everyone' }, post: { kind: 'everyone' } })
  })

  it('carries the per-field classification for a Custom channel', () => {
    const input = makeInput({
      bot: { userId: '900', roleIds: ['901'] },
      roles: [everyoneRole(), role('601', 'Staff', '0', 3)],
      channels: [{ ...textChannel('c1', 'staff', [overwrite(GUILD_ID, 0, ZERO, V | P.SendMessages), overwrite('601', 0, V)]), position: 0 }],
    })
    expect(buildAccessState(input).channels[0]).toMatchObject({
      rule: null,
      see: { kind: 'roles', roleIds: ['601'] },
      post: null,
      seeSummary: 'Only Staff',
      postSummary: 'Partly restricted',
    })
  })
})

describe('loadAccessState', () => {
  it('returns the classified snapshot for a manager and refuses others', async () => {
    const state = await loadAccessState(makeDeps(makeWorld()), ctx)
    expect(state.channels.map((c) => c.id)).toEqual(['cat', 'c1', 'c2', 'f1'])
    expect(state.channels[1]).toMatchObject({ syncedWithParent: true })
    await expect(loadAccessState(makeDeps(makeWorld({ userRolePerms: bits(P.ManageMessages) })), ctx)).rejects.toMatchObject({ status: 403 })
  })
})

describe('previewAccess', () => {
  it('returns plan, stats and canApply, cascading to the synced child', async () => {
    const preview = await previewAccess(makeDeps(makeWorld()), ctx, [edit('cat', STAFF_ONLY)])
    expect(preview.canApply).toBe(true)
    expect(preview.blockers).toEqual([])
    expect(preview.plan!.changes.map((c) => [c.channelId, c.op])).toEqual([
      ['cat', 'set-overwrite'], ['cat', 'set-overwrite'], ['cat', 'set-overwrite'], ['c1', 'replace-overwrites'],
    ])
    expect(preview.stats).toEqual({ channels: 1, cascaded: 1, changed: 2, unchanged: 0, changes: 4 })
  })

  it('reports problems as blockers with no plan and null stats', async () => {
    const preview = await previewAccess(makeDeps(makeWorld()), ctx, [edit('f1', STAFF_ONLY)])
    expect(preview.plan).toBeNull()
    expect(preview.blockers).toEqual(['#forum is not a channel type Channel Access supports.'])
    expect(preview.stats).toBeNull()
  })

  it('blocks a cascade when the bot lacks Manage Channels', async () => {
    const world = makeWorld({ botRolePerms: bits(V, P.SendMessages, P.ManageRoles, P.AddReactions, P.SendMessagesInThreads, P.CreatePublicThreads, P.CreatePrivateThreads, P.Connect, P.Speak) })
    const preview = await previewAccess(makeDeps(world), ctx, [edit('cat', STAFF_ONLY)])
    expect(preview.canApply).toBe(false)
    expect(preview.blockers.join(' ')).toContain('Manage Channels')
    expect(preview.blockers.join(' ')).toContain('this change')
  })

  it('blocks hiding a module channel from the bot, with zero writes on apply', async () => {
    // The bot starts with Send Messages in #rules through a role allow, so only the edit can regress it.
    const world = makeWorld({
      channels: [
        { id: 'cat', name: 'Team', type: 4, position: 0, parent_id: null, permission_overwrites: [] },
        { id: 'c2', name: 'rules', type: 0, position: 2, parent_id: null, permission_overwrites: [
          { id: G, type: 0, allow: '0', deny: TEXT_POST.toString() },
          { id: '901', type: 0, allow: bits(V, P.SendMessages), deny: '0' },
        ] },
      ],
      configRows: [{ moduleName: 'logging', enabled: true, settings: JSON.stringify({ auditChannelId: 'c2' }) }],
    })
    const rule: AccessRule = { see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'everyone' } }
    const preview = await previewAccess(makeDeps(world), ctx, [edit('c2', rule)])
    expect(preview.canApply).toBe(false)
    expect(preview.blockers.join(' ')).toContain('#rules')
    const deps = makeDeps(world)
    await expect(applyAccess(deps, ctx, [edit('c2', rule)], preview.plan!.hash)).rejects.toMatchObject({ status: 409 })
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('a stale role overwrite is deleted before @everyone loses View, so the bot is not locked out mid-plan', async () => {
    const world = makeWorld({
      channels: [
        { id: 'c2', name: 'rules', type: 0, position: 2, parent_id: null, permission_overwrites: [
          { id: G, type: 0, allow: '0', deny: TEXT_POST.toString() },
          { id: '602', type: 0, allow: '0', deny: P.SendMessages.toString() },
        ] },
      ],
    })
    const rule: AccessRule = { see: { kind: 'roles', roleIds: ['601'] }, post: { kind: 'everyone' } }
    const preview = await previewAccess(makeDeps(world), ctx, [edit('c2', rule)])
    expect(preview.blockers).toEqual([])
    expect(preview.canApply).toBe(true)
    expect(preview.plan!.changes.map((c) => [c.targetId, c.op])).toEqual([
      ['601', 'set-overwrite'], ['602', 'delete-overwrite'], [G, 'set-overwrite'],
    ])
  })
})

describe('applyAccess', () => {
  it('writes in plan order, logs with the access title, drops nothing on success', async () => {
    const world = makeWorld()
    const deps = makeDeps(world)
    const preview = await previewAccess(deps, ctx, [edit('cat', STAFF_ONLY)])
    const result = await applyAccess(deps, ctx, [edit('cat', STAFF_ONLY)], preview.plan!.hash)
    expect(result).toMatchObject({ applied: true, logged: true })
    const calls = deps.request.mock.calls as Array<[string, string]>
    expect(calls.map(([m, url]) => [m, url.replace('https://discord.com/api/v10', '')])).toEqual([
      ['PUT', '/channels/cat/permissions/601'],
      ['PUT', '/channels/cat/permissions/901'],
      ['PUT', '/channels/cat/permissions/12345'],
      ['PATCH', '/channels/c1'],
    ])
    expect(deps.logs.log.mock.calls[0]![0].message).toMatch(/^Channel access applied by 700: Change who can see and post in 2 channels\./)
  })

  it('refuses with 409 and zero writes when the hash does not match', async () => {
    const deps = makeDeps(makeWorld())
    await expect(applyAccess(deps, ctx, [edit('cat', STAFF_ONLY)], 'f'.repeat(64))).rejects.toMatchObject({
      status: 409,
      message: 'The channels changed since the preview. Review the changes again.',
    })
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('a child that desynced since the preview changes the hash → 409', async () => {
    const before = makeWorld()
    const hash = (await previewAccess(makeDeps(before), ctx, [edit('cat', STAFF_ONLY)])).plan!.hash
    const after = makeWorld({
      channels: [
        { id: 'cat', name: 'Team', type: 4, position: 0, parent_id: null, permission_overwrites: [] },
        { id: 'c1', name: 'general', type: 0, position: 1, parent_id: 'cat', permission_overwrites: [{ id: '602', type: 0, allow: V.toString(), deny: '0' }] },
      ],
    })
    const deps = makeDeps(after)
    await expect(applyAccess(deps, ctx, [edit('cat', STAFF_ONLY)], hash)).rejects.toMatchObject({ status: 409 })
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('refuses with 409 when every channel already matches (planner problem)', async () => {
    const deps = makeDeps(makeWorld())
    const rule: AccessRule = { see: { kind: 'everyone' }, post: { kind: 'nobody' } }
    await expect(applyAccess(deps, ctx, [edit('c2', rule)], 'a'.repeat(64))).rejects.toMatchObject({ status: 409, message: 'Every edited channel already matches its rule.' })
  })
})

describe('planAccess summary matches what blockersFor expects', () => {
  it('findingId starts with access:', () => {
    const input = makeInput({ channels: [textChannel('c1', 'a')] })
    expect(planAccess(input, [edit('c1', { see: { kind: 'everyone' }, post: { kind: 'nobody' } })]).plan!.findingId).toBe('access:1')
  })
})
