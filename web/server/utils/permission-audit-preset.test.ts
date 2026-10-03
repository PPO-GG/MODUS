import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_BITS as P } from '../../shared/discord-permissions'
import type { PresetRequest } from '../../shared/permission-presets'
import { resetBotUserIdCache } from './permission-audit-data'
import { FixError, previewPlan, type FixDeps } from './permission-audit-fix'
import { applyPreset, previewPreset } from './permission-audit-preset'
import { planPreset } from './permission-audit/presets'
import type { PlanSource } from './permission-audit/types'

const G = '12345'
const BOT = '900'
const USER = '700'
const bits = (...flags: bigint[]) => flags.reduce((a, b) => a | b, BigInt(0)).toString()
const ZERO = BigInt(0)
const READ_ONLY_DENY = P.SendMessages | P.AddReactions | P.SendMessagesInThreads | P.CreatePublicThreads | P.CreatePrivateThreads
const POSTER_ALLOW = P.SendMessages | P.AddReactions | P.SendMessagesInThreads | P.CreatePublicThreads

const BOT_ALL = bits(
  P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ManageRoles, P.ReadMessageHistory, P.AddReactions,
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
    { id: G, name: '@everyone', position: 0, permissions: bits(P.ViewChannel, P.SendMessages), managed: false },
    { id: '901', name: 'MODUS', position: 5, permissions: w.botRolePerms ?? BOT_ALL, managed: true },
    { id: '801', name: 'Admins', position: 4, permissions: w.userRolePerms ?? bits(P.ManageGuild), managed: false },
    { id: '601', name: 'Staff', position: 3, permissions: '0', managed: false },
    { id: '602', name: 'Members', position: 2, permissions: '0', managed: false },
  ]
  const channels = w.channels ?? [
    { id: 'c1', name: 'general', type: 0, parent_id: null, permission_overwrites: [] },
    { id: 'c2', name: 'rules', type: 0, parent_id: null, permission_overwrites: [] },
    { id: 'v1', name: 'Lounge', type: 2, parent_id: null, permission_overwrites: [] },
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
const readOnly = (over: Partial<PresetRequest> = {}): PresetRequest => ({
  presetId: 'read-only',
  slots: { posters: ['601'] },
  channelIds: ['c1', 'c2'],
  ...over,
})
const priv = (over: Partial<PresetRequest> = {}): PresetRequest => ({
  presetId: 'private-to-roles',
  slots: { allowed: ['602'] },
  channelIds: ['c1'],
  ...over,
})

beforeEach(() => resetBotUserIdCache())

describe('previewPreset', () => {
  it('returns the plan, stats and canApply for a manager', async () => {
    const preview = await previewPreset(makeDeps(makeWorld()), ctx, readOnly())
    expect(preview.canApply).toBe(true)
    expect(preview.blockers).toEqual([])
    expect(preview.plan!.changes).toHaveLength(4)
    expect(preview.stats).toEqual({ channels: 2, changed: 2, unchanged: 0, changes: 4 })
  })

  it('refuses a caller without Manage Server and returns no plan', async () => {
    const deps = makeDeps(makeWorld({ userRolePerms: bits(P.ManageMessages) }))
    await expect(previewPreset(deps, ctx, readOnly())).rejects.toMatchObject({ status: 403 })
  })

  it('reports problems as blockers with no plan (deleted role, unsupported channel, nothing to do)', async () => {
    const deleted = await previewPreset(makeDeps(makeWorld()), ctx, readOnly({ slots: { posters: ['999'] } }))
    expect(deleted.plan).toBeNull()
    expect(deleted.canApply).toBe(false)
    expect(deleted.blockers).toEqual(['A role chosen for "Roles that can post" no longer exists.'])
    expect(deleted.stats).toBeNull()

    const voice = await previewPreset(makeDeps(makeWorld()), ctx, readOnly({ channelIds: ['v1'] }))
    expect(voice.blockers[0]).toContain('Lounge')

    const matching = makeWorld({
      channels: [
        { id: 'c1', name: 'general', type: 0, parent_id: null, permission_overwrites: [
          { id: G, type: 0, allow: '0', deny: READ_ONLY_DENY.toString() },
          { id: '601', type: 0, allow: POSTER_ALLOW.toString(), deny: '0' },
        ] },
      ],
    })
    const none = await previewPreset(makeDeps(matching), ctx, readOnly({ channelIds: ['c1'] }))
    expect(none.plan).toBeNull()
    expect(none.blockers).toEqual(['Every selected channel already matches this preset.'])
    expect(none.stats).toMatchObject({ unchanged: 1, changes: 0 })
  })

  it('blocks when the bot lacks Manage Roles', async () => {
    const world = makeWorld({ botRolePerms: bits(P.ViewChannel, P.SendMessages) })
    const preview = await previewPreset(makeDeps(world), ctx, readOnly())
    expect(preview.canApply).toBe(false)
    expect(preview.blockers.join(' ')).toContain('Manage Roles')
  })

  it("blocks when a preset would grant permissions the bot's own role does not hold", async () => {
    const world = makeWorld({ botRolePerms: bits(P.ViewChannel, P.SendMessages, P.ManageRoles) })
    const preview = await previewPreset(makeDeps(world), ctx, readOnly())
    expect(preview.canApply).toBe(false)
    const text = preview.blockers.join(' ')
    expect(text).toContain("can't grant Add Reactions")
    expect(text).not.toContain('itself')
  })

  it('blocks Private to roles when it would remove the bot from a channel a module uses', async () => {
    const world = makeWorld({
      botRolePerms: bits(P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ManageRoles, P.ReadMessageHistory),
      configRows: [{ moduleName: 'logging', enabled: true, settings: JSON.stringify({ auditChannelId: 'c1' }) }],
    })
    const preview = await previewPreset(makeDeps(world), ctx, priv())
    expect(preview.canApply).toBe(false)
    expect(preview.blockers.join(' ')).toContain("remove the bot's access in #general")
  })

  it('does not block Private to roles when no module relies on the channel', async () => {
    const preview = await previewPreset(makeDeps(makeWorld()), ctx, priv())
    expect(preview.canApply).toBe(true)
  })

  describe("change order against the bot's own access", () => {
    const reversed: PlanSource = (input) => {
      const derived = planPreset(input, priv())
      return { ...derived, plan: derived.plan && { ...derived.plan, changes: [...derived.plan.changes].reverse() } }
    }
    const normal: PlanSource = (input) => planPreset(input, priv())

    it("blocks a plan whose first write hides the channel from the bot before its later writes", async () => {
      const preview = await previewPlan(makeDeps(makeWorld()), ctx, reversed, 'none')
      expect(preview.canApply).toBe(false)
      expect(preview.blockers.join(' ')).toContain("The bot can't see #general")
    })

    it('allows the planner order, which grants before it denies @everyone', async () => {
      const preview = await previewPlan(makeDeps(makeWorld()), ctx, normal, 'none')
      expect(preview.canApply).toBe(true)
      expect(preview.blockers).toEqual([])
    })
  })

  describe('bits the preset newly denies', () => {
    const lacksPublicThreads = () =>
      makeWorld({
        botRolePerms: bits(
          P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ManageRoles, P.ReadMessageHistory, P.AddReactions,
          P.SendMessagesInThreads, P.CreatePrivateThreads,
        ),
      })
    const noPosters = () => readOnly({ slots: { posters: [] } })

    it("blocks when the preset would deny a permission the bot's own role does not hold", async () => {
      const preview = await previewPreset(makeDeps(lacksPublicThreads()), ctx, noPosters())
      expect(preview.canApply).toBe(false)
      const text = preview.blockers.join(' ')
      expect(text).toContain("can't deny")
      expect(text).toContain('Create Public Threads')
    })

    it('does not block when the bot holds every bit the preset denies', async () => {
      const preview = await previewPreset(makeDeps(makeWorld()), ctx, noPosters())
      expect(preview.canApply).toBe(true)
      expect(preview.blockers).toEqual([])
    })

    it('refuses to apply with 409 and no writes', async () => {
      const world = lacksPublicThreads()
      const hash = (await previewPreset(makeDeps(world), ctx, noPosters())).plan!.hash
      resetBotUserIdCache()
      const deps = makeDeps(world)
      await expect(applyPreset(deps, ctx, noPosters(), hash)).rejects.toMatchObject({ status: 409 })
      expect(deps.request).not.toHaveBeenCalled()
      expect(deps.logs.log).not.toHaveBeenCalled()
    })
  })

  it('lets an Administrator bot apply regardless of listed permissions', async () => {
    const preview = await previewPreset(makeDeps(makeWorld({ botRolePerms: bits(P.Administrator) })), ctx, readOnly())
    expect(preview.canApply).toBe(true)
  })
})

describe('applyPreset', () => {
  async function hashFor(world: ReturnType<typeof makeWorld>, req: PresetRequest) {
    const hash = (await previewPreset(makeDeps(world), ctx, req)).plan!.hash
    resetBotUserIdCache()
    return hash
  }

  it('performs one PUT per changed overwrite, in plan order, with raw bitfields, then logs', async () => {
    const world = makeWorld()
    const hash = await hashFor(world, readOnly())
    const deps = makeDeps(world)
    const result = await applyPreset(deps, ctx, readOnly(), hash)
    expect(result).toMatchObject({ applied: true, logged: true })
    expect(deps.request.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['PUT', 'https://discord.com/api/v10/channels/c1/permissions/601'],
      ['PUT', `https://discord.com/api/v10/channels/c1/permissions/${G}`],
      ['PUT', 'https://discord.com/api/v10/channels/c2/permissions/601'],
      ['PUT', `https://discord.com/api/v10/channels/c2/permissions/${G}`],
    ])
    expect(deps.request.mock.calls[0]![3]).toEqual({ type: 0, allow: POSTER_ALLOW.toString(), deny: '0' })
    expect(deps.request.mock.calls[1]![3]).toEqual({ type: 0, allow: '0', deny: READ_ONLY_DENY.toString() })
    expect(deps.request.mock.calls[0]![2]).toEqual({ Authorization: 'Bot SECRET-TOKEN' })
    const entry = deps.logs.log.mock.calls[0]![0]
    expect(entry).toMatchObject({ guildId: G, level: 'info', source: 'permission-audit' })
    expect(entry.message).toContain('Permission preset applied by 700')
    expect(entry.message).not.toContain('SECRET-TOKEN')
  })

  it('refuses with 409 and no writes when a selected channel changed since the preview', async () => {
    const hash = await hashFor(makeWorld(), readOnly())
    const changed = makeWorld({
      channels: [
        { id: 'c1', name: 'general', type: 0, parent_id: null, permission_overwrites: [{ id: G, type: 0, allow: bits(P.AttachFiles), deny: '0' }] },
        { id: 'c2', name: 'rules', type: 0, parent_id: null, permission_overwrites: [] },
      ],
    })
    const deps = makeDeps(changed)
    await expect(applyPreset(deps, ctx, readOnly(), hash)).rejects.toMatchObject({ status: 409 })
    expect(deps.request).not.toHaveBeenCalled()
    expect(deps.logs.log).not.toHaveBeenCalled()
  })

  it('gives the same hash for the same selection listed in a different order', async () => {
    const a = await hashFor(makeWorld(), readOnly({ channelIds: ['c1', 'c2'] }))
    const deps = makeDeps(makeWorld())
    await expect(applyPreset(deps, ctx, readOnly({ channelIds: ['c2', 'c1'] }), a)).resolves.toMatchObject({ applied: true })
  })

  it('refuses a caller without authority with no writes', async () => {
    const hash = await hashFor(makeWorld(), readOnly())
    const deps = makeDeps(makeWorld({ userRolePerms: '0' }))
    await expect(applyPreset(deps, ctx, readOnly(), hash)).rejects.toMatchObject({ status: 403 })
    expect(deps.request).not.toHaveBeenCalled()
    expect(deps.logs.log).not.toHaveBeenCalled()
  })

  it('refuses with 409 and no writes when there are blockers', async () => {
    const world = makeWorld({ botRolePerms: bits(P.ViewChannel, P.SendMessages) })
    const hash = await hashFor(world, readOnly())
    const deps = makeDeps(world)
    await expect(applyPreset(deps, ctx, readOnly(), hash)).rejects.toMatchObject({ status: 409 })
    expect(deps.request).not.toHaveBeenCalled()
    expect(deps.logs.log).not.toHaveBeenCalled()
  })

  it('refuses with 409 and the problem text when the data no longer fits the request', async () => {
    const deps = makeDeps(makeWorld())
    const error = await applyPreset(deps, ctx, readOnly({ slots: { posters: ['999'] } }), 'a'.repeat(64)).catch((e) => e)
    expect(error).toBeInstanceOf(FixError)
    expect(error.status).toBe(409)
    expect(error.message).toContain('no longer exists')
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('stops at the first failure, reports how many were applied, and logs exactly the applied subset', async () => {
    const world = makeWorld()
    const hash = await hashFor(world, readOnly())
    let calls = 0
    const request = vi.fn(async () => {
      calls += 1
      if (calls === 3) throw Object.assign(new Error('Bot SECRET-TOKEN failed'), { status: 403, data: { message: 'Missing Permissions' } })
    })
    const deps = makeDeps(world, { request } as Partial<FixDeps>)
    const error = await applyPreset(deps, ctx, readOnly(), hash).catch((e) => e)
    expect(error).toBeInstanceOf(FixError)
    expect(error.status).toBe(403)
    expect(error.applied).toBe(2)
    expect(error.message).toContain('2 of 4 changes were applied')
    expect(error.message).toContain('Missing Permissions')
    expect(error.message).not.toContain('SECRET-TOKEN')
    expect(request).toHaveBeenCalledTimes(3)
    expect(deps.logs.log).toHaveBeenCalledTimes(1)
    const message = deps.logs.log.mock.calls[0]![0].message as string
    expect(message).toContain('PARTIALLY applied (2 of 4)')
    expect(message).toContain('"channel":"c1"')
    expect(message).not.toContain('"channel":"c2"')
  })

  it('writes nothing to the log when the very first write fails', async () => {
    const world = makeWorld()
    const hash = await hashFor(world, readOnly())
    const request = vi.fn(async () => { throw Object.assign(new Error('x'), { status: 403, data: { message: 'Missing Access' } }) })
    const deps = makeDeps(world, { request } as Partial<FixDeps>)
    const error = await applyPreset(deps, ctx, readOnly(), hash).catch((e) => e)
    expect(error.status).toBe(403)
    expect(error.applied).toBe(0)
    expect(error.message).not.toContain('changes were applied')
    expect(deps.logs.log).not.toHaveBeenCalled()
  })

  it('applies Private to roles against a Discord that hides a channel from the bot once @everyone View is denied', async () => {
    const world = makeWorld()
    const hash = await hashFor(world, priv({ channelIds: ['c1', 'c2'] }))
    const hidden = new Set<string>()
    const request = vi.fn(async (_method: string, url: string, _headers: unknown, body?: any) => {
      const match = /channels\/([^/]+)\/permissions\/([^/]+)$/.exec(url)!
      const [, channelId, targetId] = match
      if (hidden.has(channelId!)) throw Object.assign(new Error('x'), { status: 403, data: { message: 'Missing Access' } })
      if (targetId === G && (BigInt(body.deny) & P.ViewChannel) !== ZERO) hidden.add(channelId!)
    })
    const deps = makeDeps(world, { request } as Partial<FixDeps>)
    const result = await applyPreset(deps, ctx, priv({ channelIds: ['c1', 'c2'] }), hash)
    expect(result).toMatchObject({ applied: true, logged: true })
    expect(request.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['PUT', 'https://discord.com/api/v10/channels/c1/permissions/602'],
      ['PUT', `https://discord.com/api/v10/channels/c1/permissions/${G}`],
      ['PUT', 'https://discord.com/api/v10/channels/c2/permissions/602'],
      ['PUT', `https://discord.com/api/v10/channels/c2/permissions/${G}`],
    ])
  })

  it('reports logged: false but still succeeds when the log insert fails', async () => {
    const world = makeWorld()
    const hash = await hashFor(world, readOnly())
    const deps = makeDeps(world, { logs: { log: vi.fn(async () => { throw new Error('db down') }) } } as Partial<FixDeps>)
    await expect(applyPreset(deps, ctx, readOnly(), hash)).resolves.toMatchObject({ applied: true, logged: false })
  })
})
