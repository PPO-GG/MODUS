import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_BITS as P } from '../../shared/discord-permissions'
import { BotNotInGuildError, resetBotUserIdCache } from './permission-audit-data'
import {
  FixError,
  applyFix,
  fixErrorToHttp,
  previewFix,
  type FixContext,
  type FixDeps,
} from './permission-audit-fix'

const G = '12345'
const BOT = '900'
const USER = '700'
const bits = (...flags: bigint[]) => flags.reduce((a, b) => a | b, BigInt(0)).toString()

interface World {
  ownerId?: string
  userRoles?: string[] | null
  userRolePerms?: string
  botRolePerms?: string
  everyonePerms?: string
  channels?: unknown[]
}

function makeWorld(w: World = {}) {
  const roles = [
    { id: G, name: '@everyone', position: 0, permissions: w.everyonePerms ?? bits(P.ViewChannel, P.SendMessages), managed: false },
    { id: '901', name: 'MODUS', position: 5, permissions: w.botRolePerms ?? bits(P.ViewChannel, P.SendMessages, P.ManageRoles, P.ManageChannels), managed: true },
    { id: '801', name: 'Staff', position: 3, permissions: w.userRolePerms ?? bits(P.ManageGuild), managed: false },
  ]
  const channels = w.channels ?? [
    { id: 'c1', name: 'general', type: 0, parent_id: null, permission_overwrites: [{ id: G, type: 0, allow: bits(P.ManageChannels, P.SendMessages), deny: '0' }] },
  ]
  const get = vi.fn(async (url: string) => {
    if (url.endsWith('/users/@me')) return { id: BOT }
    if (url.endsWith('/roles')) return roles
    if (url.endsWith('/channels')) return channels
    if (url.endsWith(`/members/${BOT}`)) return { roles: ['901'] }
    if (url.endsWith(`/members/${USER}`)) {
      if (w.userRoles === null) throw Object.assign(new Error('Unknown Member'), { status: 404 })
      return { roles: w.userRoles ?? ['801'] }
    }
    if (url.endsWith(`/guilds/${G}`)) return { owner_id: w.ownerId ?? '111' }
    throw new Error(`unexpected url ${url}`)
  })
  return { get }
}

function makeDeps(world: ReturnType<typeof makeWorld>, over: Partial<FixDeps> = {}): FixDeps & {
  request: ReturnType<typeof vi.fn>
  logs: { log: ReturnType<typeof vi.fn> }
} {
  const request = vi.fn(async () => undefined)
  const logs = { log: vi.fn(async () => undefined) }
  return {
    botToken: 'SECRET-TOKEN',
    get: world.get,
    request,
    configs: { listByGuild: vi.fn(async () => []) },
    logs,
    ...over,
  } as any
}

const ctx = (over: Partial<FixContext> = {}): FixContext => ({
  guildId: G,
  userId: USER,
  findingId: 'everyone-channel-manage:c1',
  ...over,
})

beforeEach(() => resetBotUserIdCache())

describe('previewFix', () => {
  it('returns the plan and canApply for a manager', async () => {
    const preview = await previewFix(makeDeps(makeWorld()), ctx())
    expect(preview.canApply).toBe(true)
    expect(preview.blockers).toEqual([])
    expect(preview.plan!.changes[0]!.op).toBe('set-overwrite')
  })

  it('accepts the guild owner and an Administrator even without Manage Server', async () => {
    await expect(previewFix(makeDeps(makeWorld({ ownerId: USER, userRolePerms: '0' })), ctx())).resolves.toBeTruthy()
    await expect(previewFix(makeDeps(makeWorld({ userRolePerms: bits(P.Administrator) })), ctx())).resolves.toBeTruthy()
  })

  it('refuses a caller with no Manage Server, without returning the plan', async () => {
    const deps = makeDeps(makeWorld({ userRolePerms: bits(P.ManageMessages) }))
    await expect(previewFix(deps, ctx())).rejects.toMatchObject({ status: 403 })
  })

  it('refuses a caller who is not in the guild', async () => {
    await expect(previewFix(makeDeps(makeWorld({ userRoles: null })), ctx())).rejects.toMatchObject({ status: 403 })
  })

  it('reports a blocker when the bot cannot edit overwrites', async () => {
    const preview = await previewFix(makeDeps(makeWorld({ botRolePerms: bits(P.ViewChannel, P.SendMessages) })), ctx())
    expect(preview.canApply).toBe(false)
    expect(preview.blockers.join(' ')).toContain('Manage Roles')
    expect(preview.plan).not.toBeNull()
  })

  it('needs Manage Channels as well for a category sync', async () => {
    const channels = [
      { id: 'cat', name: 'Staff', type: 4, parent_id: null, permission_overwrites: [{ id: G, type: 0, allow: '0', deny: bits(P.ViewChannel) }] },
      { id: 'child', name: 'mod-chat', type: 0, parent_id: 'cat', permission_overwrites: [{ id: G, type: 0, allow: bits(P.ViewChannel), deny: '0' }] },
    ]
    const world = makeWorld({ channels, botRolePerms: bits(P.ViewChannel, P.SendMessages, P.ManageRoles) })
    const preview = await previewFix(makeDeps(world), ctx({ findingId: 'child-exposed:child' }))
    expect(preview.canApply).toBe(false)
    expect(preview.blockers.join(' ')).toContain('Manage Channels')
  })

  it('returns no plan and a blocker for a finding that no longer applies', async () => {
    const preview = await previewFix(makeDeps(makeWorld()), ctx({ findingId: 'everyone-channel-manage:gone' }))
    expect(preview.plan).toBeNull()
    expect(preview.canApply).toBe(false)
    expect(preview.blockers.length).toBe(1)
  })

  it('lets an Administrator bot apply regardless of its listed permissions', async () => {
    const preview = await previewFix(makeDeps(makeWorld({ botRolePerms: bits(P.Administrator) })), ctx())
    expect(preview.canApply).toBe(true)
  })

  it('propagates BotNotInGuildError when Discord denies the bot', async () => {
    const get = vi.fn(async (url: string) => {
      if (url.endsWith('/users/@me')) return { id: BOT }
      throw Object.assign(new Error('Missing Access'), { status: 403 })
    })
    await expect(previewFix(makeDeps({ get } as any), ctx())).rejects.toBeInstanceOf(BotNotInGuildError)
  })
})

const configsWith = (...mods: Array<{ moduleName: string; settings: Record<string, unknown> }>) => ({
  listByGuild: vi.fn(async () =>
    mods.map((m) => ({ moduleName: m.moduleName, enabled: true, settings: JSON.stringify(m.settings) })),
  ),
})

describe('blockers: a fix that would break a module', () => {
  // @everyone has no View at guild level, so the bot sees #verify only through the channel's @everyone allow.
  const syncWorld = (over: World = {}) =>
    makeWorld({
      everyonePerms: bits(P.SendMessages),
      botRolePerms: bits(P.SendMessages, P.EmbedLinks, P.ManageRoles, P.ManageChannels),
      channels: [
        { id: 'cat', name: 'Welcome', type: 4, parent_id: null, permission_overwrites: [{ id: G, type: 0, allow: '0', deny: bits(P.ViewChannel) }, { id: '55', type: 0, allow: bits(P.ViewChannel), deny: '0' }] },
        { id: 'verify', name: 'verify', type: 0, parent_id: 'cat', permission_overwrites: [{ id: G, type: 0, allow: bits(P.ViewChannel), deny: '0' }] },
      ],
      ...over,
    })
  const sync = ctx({ findingId: 'child-exposed:verify' })
  const verification = configsWith({ moduleName: 'verification', settings: { verificationChannelId: 'verify' } })

  it("blocks a category sync that would take away the bot's access to a configured channel", async () => {
    const preview = await previewFix(makeDeps(syncWorld(), { configs: verification } as any), sync)
    expect(preview.plan).not.toBeNull()
    expect(preview.canApply).toBe(false)
    expect(preview.blockers).toHaveLength(1)
    expect(preview.blockers[0]).toContain('#verify')
    expect(preview.blockers[0]).toContain('verification')
    expect(preview.blockers[0]).toContain('View Channel')
  })

  it('refuses to apply that sync with 409 and performs no writes', async () => {
    const hash = (await previewFix(makeDeps(syncWorld(), { configs: verification } as any), sync)).plan!.hash
    resetBotUserIdCache()
    const deps = makeDeps(syncWorld(), { configs: verification } as any)
    const error = await applyFix(deps, sync, hash).catch((e) => e)
    expect(error).toMatchObject({ status: 409 })
    expect(error.message).toContain('#verify')
    expect(deps.request).not.toHaveBeenCalled()
    expect(deps.logs.log).not.toHaveBeenCalled()
  })

  it('still lets the same sync through when no module relies on the channel', async () => {
    const unrelated = makeDeps(syncWorld(), { configs: configsWith({ moduleName: 'verification', settings: { verificationChannelId: 'elsewhere' } }) } as any)
    expect((await previewFix(unrelated, sync)).canApply).toBe(true)
    resetBotUserIdCache()
    const none = await previewFix(makeDeps(syncWorld()), sync)
    expect(none.canApply).toBe(true)
    expect(none.blockers).toEqual([])
  })

  it('does not block an Administrator bot', async () => {
    const deps = makeDeps(syncWorld({ botRolePerms: bits(P.Administrator) }), { configs: verification } as any)
    const preview = await previewFix(deps, sync)
    expect(preview.canApply).toBe(true)
    expect(preview.blockers).toEqual([])
  })
})

describe('blockers: what Discord will refuse', () => {
  const channelWith = (overwrites: unknown[]) => [{ id: 'c1', name: 'general', type: 0, parent_id: null, permission_overwrites: overwrites }]

  it("blocks an overwrite edit in a channel the bot can't see", async () => {
    const channels = channelWith([{ id: G, type: 0, allow: bits(P.ManageChannels), deny: bits(P.ViewChannel) }])
    const preview = await previewFix(makeDeps(makeWorld({ channels })), ctx())
    expect(preview.canApply).toBe(false)
    expect(preview.blockers).toEqual([
      "The bot can't see #general, so Discord won't let it change that channel's permissions. Allow it to view the channel first.",
    ])
  })

  it('blocks when Manage Roles is denied in that channel even though the role has it', async () => {
    const channels = channelWith([
      { id: G, type: 0, allow: bits(P.ManageChannels), deny: '0' },
      { id: BOT, type: 1, allow: '0', deny: bits(P.ManageRoles) },
    ])
    const preview = await previewFix(makeDeps(makeWorld({ channels })), ctx())
    expect(preview.canApply).toBe(false)
    expect(preview.blockers).toHaveLength(1)
    expect(preview.blockers[0]).toContain('Manage Roles')
    expect(preview.blockers[0]).toContain('#general')
  })

  it('refuses to apply with 409 and no writes when the bot cannot see the channel', async () => {
    const channels = channelWith([{ id: G, type: 0, allow: bits(P.ManageChannels), deny: bits(P.ViewChannel) }])
    const hash = (await previewFix(makeDeps(makeWorld({ channels })), ctx())).plan!.hash
    resetBotUserIdCache()
    const deps = makeDeps(makeWorld({ channels }))
    await expect(applyFix(deps, ctx(), hash)).rejects.toMatchObject({ status: 409 })
    expect(deps.request).not.toHaveBeenCalled()
  })

  it("blocks a bot self-grant of permissions its role doesn't have", async () => {
    // The bot role lacks Embed Links; the log channel needs it, so the fix would grant it.
    const deps = makeDeps(makeWorld({ channels: channelWith([]) }), { configs: configsWith({ moduleName: 'logging', settings: { auditChannelId: 'c1' } }) } as any)
    const preview = await previewFix(deps, ctx({ findingId: 'channel-perms:logging:c1' }))
    expect(preview.canApply).toBe(false)
    expect(preview.blockers).toEqual([
      "The bot can't grant itself Embed Links because its role doesn't have them. Enable them on the bot's role first.",
    ])
  })

  it('lets the bot self-grant what its role already holds', async () => {
    // Embed Links is on the bot role but denied for @everyone in this channel.
    const channels = channelWith([{ id: G, type: 0, allow: '0', deny: bits(P.EmbedLinks) }])
    const world = makeWorld({ channels, botRolePerms: bits(P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ManageRoles, P.ManageChannels) })
    const deps = makeDeps(world, { configs: configsWith({ moduleName: 'logging', settings: { auditChannelId: 'c1' } }) } as any)
    const preview = await previewFix(deps, ctx({ findingId: 'channel-perms:logging:c1' }))
    expect(preview.plan).not.toBeNull()
    expect(preview.blockers).toEqual([])
    expect(preview.canApply).toBe(true)
  })

  it('does not block an Administrator bot', async () => {
    const channels = channelWith([{ id: G, type: 0, allow: bits(P.ManageChannels), deny: bits(P.ViewChannel) }])
    const preview = await previewFix(makeDeps(makeWorld({ channels, botRolePerms: bits(P.Administrator) })), ctx())
    expect(preview.canApply).toBe(true)
    expect(preview.blockers).toEqual([])
  })
})

describe('applyFix', () => {
  async function previewHash(world: ReturnType<typeof makeWorld>, c = ctx()) {
    return (await previewFix(makeDeps(world), c)).plan!.hash
  }

  it('sets the @everyone overwrite with the raw remaining bits and logs the previous state', async () => {
    const world = makeWorld()
    const deps = makeDeps(world)
    const hash = await previewHash(world)
    resetBotUserIdCache()
    const result = await applyFix(deps, ctx(), hash)
    expect(result.applied).toBe(true)
    expect(result.logged).toBe(true)
    expect(deps.request).toHaveBeenCalledTimes(1)
    expect(deps.request).toHaveBeenCalledWith(
      'PUT',
      `https://discord.com/api/v10/channels/c1/permissions/${G}`,
      { Authorization: 'Bot SECRET-TOKEN' },
      { type: 0, allow: P.SendMessages.toString(), deny: '0' },
    )
    const entry = deps.logs.log.mock.calls[0]![0]
    expect(entry).toMatchObject({ guildId: G, level: 'info', source: 'permission-audit' })
    expect(entry.message).toContain(USER)
    expect(entry.message).toContain(bits(P.ManageChannels, P.SendMessages))
    expect(entry.message).not.toContain('SECRET-TOKEN')
  })

  it('deletes an overwrite that becomes empty', async () => {
    const channels = [{ id: 'c1', name: 'general', type: 0, parent_id: null, permission_overwrites: [{ id: G, type: 0, allow: bits(P.MentionEveryone), deny: '0' }] }]
    const world = makeWorld({ channels })
    const c = ctx({ findingId: 'everyone-channel-mention:c1' })
    const hash = await previewHash(world, c)
    resetBotUserIdCache()
    const deps = makeDeps(world)
    await applyFix(deps, c, hash)
    expect(deps.request).toHaveBeenCalledWith('DELETE', `https://discord.com/api/v10/channels/c1/permissions/${G}`, { Authorization: 'Bot SECRET-TOKEN' })
  })

  it("patches the channel's overwrites for a category sync", async () => {
    const channels = [
      { id: 'cat', name: 'Staff', type: 4, parent_id: null, permission_overwrites: [{ id: G, type: 0, allow: '0', deny: bits(P.ViewChannel) }] },
      { id: 'child', name: 'mod-chat', type: 0, parent_id: 'cat', permission_overwrites: [{ id: G, type: 0, allow: bits(P.ViewChannel), deny: '0' }] },
    ]
    const world = makeWorld({ channels })
    const c = ctx({ findingId: 'child-exposed:child' })
    const hash = await previewHash(world, c)
    resetBotUserIdCache()
    const deps = makeDeps(world)
    await applyFix(deps, c, hash)
    expect(deps.request).toHaveBeenCalledWith(
      'PATCH',
      'https://discord.com/api/v10/channels/child',
      { Authorization: 'Bot SECRET-TOKEN' },
      { permission_overwrites: [{ id: G, type: 0, allow: '0', deny: bits(P.ViewChannel) }] },
    )
  })

  it('refuses with 409 and performs no writes when the channel changed since the preview', async () => {
    const world = makeWorld()
    const hash = await previewHash(world)
    resetBotUserIdCache()
    const changed = makeWorld({
      channels: [{ id: 'c1', name: 'general', type: 0, parent_id: null, permission_overwrites: [{ id: G, type: 0, allow: bits(P.ManageChannels, P.SendMessages, P.AttachFiles), deny: '0' }] }],
    })
    const deps = makeDeps(changed)
    await expect(applyFix(deps, ctx(), hash)).rejects.toMatchObject({ status: 409 })
    expect(deps.request).not.toHaveBeenCalled()
    expect(deps.logs.log).not.toHaveBeenCalled()
  })

  it('refuses with 403 and performs no writes when the caller lacks authority', async () => {
    const world = makeWorld()
    const hash = await previewHash(world)
    resetBotUserIdCache()
    const deps = makeDeps(makeWorld({ userRolePerms: '0' }))
    await expect(applyFix(deps, ctx(), hash)).rejects.toMatchObject({ status: 403 })
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('refuses with 409 when the bot lacks the capability, with no writes', async () => {
    const world = makeWorld({ botRolePerms: bits(P.ViewChannel, P.SendMessages) })
    const hash = await previewHash(world)
    resetBotUserIdCache()
    const deps = makeDeps(world)
    await expect(applyFix(deps, ctx(), hash)).rejects.toMatchObject({ status: 409 })
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('refuses with 404 when the finding no longer applies', async () => {
    const deps = makeDeps(makeWorld())
    await expect(applyFix(deps, ctx({ findingId: 'everyone-channel-manage:gone' }), 'a'.repeat(64))).rejects.toMatchObject({ status: 404 })
  })

  it('reports logged: false but still succeeds when the log insert fails', async () => {
    const world = makeWorld()
    const hash = await previewHash(world)
    resetBotUserIdCache()
    const deps = makeDeps(world, { logs: { log: vi.fn(async () => { throw new Error('db down') }) } } as any)
    const result = await applyFix(deps, ctx(), hash)
    expect(result).toMatchObject({ applied: true, logged: false })
    expect(deps.request).toHaveBeenCalledTimes(1)
  })

  it('maps a Discord 403 on the write to a clear 403 without leaking the token', async () => {
    const world = makeWorld()
    const hash = await previewHash(world)
    resetBotUserIdCache()
    const request = vi.fn(async () => {
      throw Object.assign(new Error('Request failed with Bot SECRET-TOKEN'), { status: 403, data: { message: 'Missing Permissions' } })
    })
    const deps = makeDeps(world, { request } as any)
    const error = await applyFix(deps, ctx(), hash).catch((e) => e)
    expect(error).toBeInstanceOf(FixError)
    expect(error.status).toBe(403)
    expect(error.message).toContain('Missing Permissions')
    expect(error.message).not.toContain('SECRET-TOKEN')
    expect(deps.logs.log).not.toHaveBeenCalled()
  })
})

describe('fixErrorToHttp', () => {
  it('maps the known error types', () => {
    expect(fixErrorToHttp(new FixError(409, 'changed'))).toEqual({ statusCode: 409, message: 'changed' })
    expect(fixErrorToHttp(new BotNotInGuildError()).statusCode).toBe(404)
    expect(fixErrorToHttp(Object.assign(new Error('x'), { status: 429 })).statusCode).toBe(429)
    expect(fixErrorToHttp(new Error('boom')).statusCode).toBe(502)
  })
})
