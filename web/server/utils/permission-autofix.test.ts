import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERMISSION_BITS as P } from '../../shared/discord-permissions'
import { resetBotUserIdCache } from './permission-audit-data'
import type { FixDeps } from './permission-audit-fix'
import { autoGrantModuleChannels } from './permission-autofix'

const G = '12345'
const BOT = '900'
const USER = '700'
const bits = (...flags: bigint[]) => flags.reduce((a, b) => a | b, BigInt(0)).toString()

// The bot role holds Embed Links, but @everyone is denied it in #logs by an overwrite,
// so the bot's access to #logs is missing it until the fix grants it back.
const BOT_ROLE = bits(P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ManageRoles, P.ManageChannels)
const logsChannel = (overwrites: unknown[]) => ({
  id: 'c1',
  name: 'logs',
  type: 0,
  parent_id: null,
  permission_overwrites: overwrites,
})
const denyEmbed = [{ id: G, type: 0, allow: '0', deny: bits(P.EmbedLinks) }]

function makeDeps(opts: { botRole?: string; channels?: unknown[]; ownerId?: string; modules?: unknown[] } = {}) {
  const roles = [
    { id: G, name: '@everyone', position: 0, permissions: bits(P.ViewChannel, P.SendMessages), managed: false },
    { id: '901', name: 'MODUS', position: 5, permissions: opts.botRole ?? BOT_ROLE, managed: true },
    { id: '801', name: 'Staff', position: 3, permissions: bits(P.ManageGuild), managed: false },
  ]
  const channels = opts.channels ?? [logsChannel(denyEmbed)]
  const get = vi.fn(async (url: string) => {
    if (url.endsWith('/users/@me')) return { id: BOT }
    if (url.endsWith('/roles')) return roles
    if (url.endsWith('/channels')) return channels
    if (url.endsWith(`/members/${BOT}`)) return { roles: ['901'] }
    if (url.endsWith(`/members/${USER}`)) return { roles: ['801'] }
    if (url.endsWith(`/guilds/${G}`)) return { owner_id: opts.ownerId ?? '111' }
    if (url.includes('/members/')) throw Object.assign(new Error('Unknown Member'), { status: 404 })
    throw new Error(`unexpected url ${url}`)
  })
  const request = vi.fn(async () => undefined)
  const modules = opts.modules ?? [{ moduleName: 'logging', enabled: true, settings: JSON.stringify({ auditChannelId: 'c1' }) }]
  return {
    botToken: 'SECRET-TOKEN',
    get,
    request,
    configs: { listByGuild: vi.fn(async () => modules) },
    logs: { log: vi.fn(async () => undefined) },
  } as unknown as FixDeps & { request: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> }
}

const ctx = { guildId: G, userId: USER }

beforeEach(() => resetBotUserIdCache())

describe('autoGrantModuleChannels', () => {
  it('grants the bot the channel access the saved module needs', async () => {
    const deps = makeDeps()
    const result = await autoGrantModuleChannels(deps, ctx, 'logging')
    expect(result.applied).toEqual(['Allow the bot the permissions logging needs in #logs'])
    expect(result.blocked).toEqual([])
    expect(deps.request).toHaveBeenCalledWith(
      'PUT',
      `https://discord.com/api/v10/channels/c1/permissions/${BOT}`,
      expect.anything(),
      expect.objectContaining({ type: 1 }),
    )
  })

  it('writes nothing when the bot already has access', async () => {
    const deps = makeDeps({ channels: [logsChannel([])] })
    const result = await autoGrantModuleChannels(deps, ctx, 'logging')
    expect(result).toEqual({ applied: [], blocked: [] })
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('only touches the module that was saved', async () => {
    const deps = makeDeps()
    const result = await autoGrantModuleChannels(deps, ctx, 'welcome')
    expect(result).toEqual({ applied: [], blocked: [] })
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('reports a channel it cannot fix instead of writing', async () => {
    // The bot role itself lacks Embed Links, so it cannot grant itself that.
    const deps = makeDeps({ botRole: bits(P.ViewChannel, P.SendMessages, P.ManageRoles, P.ManageChannels) })
    const result = await autoGrantModuleChannels(deps, ctx, 'logging')
    expect(result.applied).toEqual([])
    expect(result.blocked).toEqual([
      {
        channel: 'logs',
        reasons: ["The bot can't grant itself Embed Links because its role doesn't have them. Enable them on the bot's role first."],
      },
    ])
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('does nothing for a caller without Manage Server', async () => {
    const deps = makeDeps()
    const result = await autoGrantModuleChannels(deps, { guildId: G, userId: 'not-staff' }, 'logging')
    expect(result).toEqual({ applied: [], blocked: [] })
    expect(deps.request).not.toHaveBeenCalled()
  })

  it('never throws when Discord fails', async () => {
    const deps = makeDeps()
    deps.get.mockRejectedValue(new Error('boom'))
    await expect(autoGrantModuleChannels(deps, ctx, 'logging')).resolves.toEqual({ applied: [], blocked: [] })
  })
})
