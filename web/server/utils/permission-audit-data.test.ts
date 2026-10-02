import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BotNotInGuildError,
  createTtlCache,
  loadAuditInput,
  resetBotUserIdCache,
  type ConfigRepo,
} from './permission-audit-data'

const API = 'https://discord.com/api/v10'
const HEADERS = { Authorization: 'Bot tok' }

type Overrides = Partial<Record<'me' | 'roles' | 'channels' | 'member', unknown>>

function makeGet(over: Overrides = {}) {
  return vi.fn(async (url: string) => {
    if (url.endsWith('/users/@me')) return 'me' in over ? over.me : { id: '900' }
    if (url.endsWith('/roles'))
      return 'roles' in over
        ? over.roles
        : [
            // @everyone's id is the guild id.
            { id: url.match(/guilds\/(\d+)\//)![1], name: '@everyone', position: 0, permissions: '1024', managed: false },
            { id: '901', name: 'MODUS', position: 5, permissions: '8', managed: true },
          ]
    if (url.endsWith('/channels'))
      return 'channels' in over
        ? over.channels
        : [{ id: 'c1', name: 'general', type: 0, parent_id: null, permission_overwrites: [{ id: '100', type: 0, allow: '0', deny: '1024' }] }]
    if (url.includes('/members/')) return 'member' in over ? over.member : { roles: ['901'] }
    throw new Error(`unexpected url ${url}`)
  })
}

const failing = (status: number) => () => {
  throw Object.assign(new Error('boom'), { status })
}

function makeConfigs(rows: Array<{ moduleName: string; enabled: boolean; settings: string }> = []): ConfigRepo {
  return { listByGuild: vi.fn(async () => rows) }
}

beforeEach(() => resetBotUserIdCache())

describe('loadAuditInput', () => {
  it('requests roles, channels and the bot member with the bot token', async () => {
    const get = makeGet()
    await loadAuditInput('12345', 'tok', get, makeConfigs())
    expect(get).toHaveBeenCalledWith(`${API}/users/@me`, HEADERS)
    expect(get).toHaveBeenCalledWith(`${API}/guilds/12345/roles`, HEADERS)
    expect(get).toHaveBeenCalledWith(`${API}/guilds/12345/channels`, HEADERS)
    expect(get).toHaveBeenCalledWith(`${API}/guilds/12345/members/900`, HEADERS)
  })

  it('maps Discord objects to the engine input', async () => {
    const input = await loadAuditInput('12345', 'tok', makeGet(), makeConfigs())
    expect(input.guildId).toBe('12345')
    expect(input.bot).toEqual({ userId: '900', roleIds: ['901'] })
    expect(input.roles[1]).toEqual({ id: '901', name: 'MODUS', position: 5, permissions: '8', managed: true })
    expect(input.channels[0]).toEqual({
      id: 'c1',
      name: 'general',
      type: 0,
      parent_id: null,
      permission_overwrites: [{ id: '100', type: 0, allow: '0', deny: '1024' }],
    })
  })

  it('parses module rows, defaulting invalid JSON settings to {}', async () => {
    const input = await loadAuditInput(
      '12345',
      'tok',
      makeGet(),
      makeConfigs([
        { moduleName: 'logging', enabled: true, settings: '{"auditChannelId":"c1"}' },
        { moduleName: 'tickets', enabled: false, settings: 'not json' },
        { moduleName: 'xp', enabled: true, settings: '"a string"' },
      ]),
    )
    expect(input.modules).toEqual([
      { name: 'logging', enabled: true, settings: { auditChannelId: 'c1' } },
      { name: 'tickets', enabled: false, settings: {} },
      { name: 'xp', enabled: true, settings: {} },
    ])
  })

  it('fails instead of returning an empty report when Discord sends an unusable body', async () => {
    const bad: Overrides[] = [
      { roles: { message: 'nope' } },
      { roles: '<html>gateway</html>' },
      { roles: [] },
      { channels: null },
      { channels: { message: 'nope' } },
      { member: {} },
      { member: null },
    ]
    for (const over of bad) {
      await expect(
        loadAuditInput('12345', 'tok', makeGet(over), makeConfigs()),
      ).rejects.toThrow(/unexpected response/i)
    }
  })

  it('throws BotNotInGuildError on Discord 403 or 404', async () => {
    for (const status of [403, 404]) {
      resetBotUserIdCache()
      const get = vi.fn(async (url: string) => {
        if (url.endsWith('/users/@me')) return { id: '900' }
        return failing(status)()
      })
      await expect(loadAuditInput('12345', 'tok', get, makeConfigs())).rejects.toBeInstanceOf(BotNotInGuildError)
    }
  })

  it('rethrows other upstream errors unchanged', async () => {
    const get = vi.fn(async (url: string) => {
      if (url.endsWith('/users/@me')) return { id: '900' }
      return failing(500)()
    })
    await expect(loadAuditInput('12345', 'tok', get, makeConfigs())).rejects.toMatchObject({ status: 500 })
  })

  it('rejects a guild id that is not numeric before making any request', async () => {
    const get = makeGet()
    await expect(loadAuditInput('123/../456', 'tok', get, makeConfigs())).rejects.toThrow(/guild id/i)
    expect(get).not.toHaveBeenCalled()
  })

  it('fails clearly when /users/@me returns no id', async () => {
    await expect(loadAuditInput('12345', 'tok', makeGet({ me: {} }), makeConfigs())).rejects.toThrow(/bot user/i)
  })

  it('looks up the bot user id only once across calls', async () => {
    const get = makeGet()
    await loadAuditInput('12345', 'tok', get, makeConfigs())
    await loadAuditInput('67890', 'tok', get, makeConfigs())
    expect(get.mock.calls.filter(([url]) => url.endsWith('/users/@me'))).toHaveLength(1)
  })
})

describe('createTtlCache', () => {
  it('returns a value until the TTL elapses', () => {
    let now = 1_000
    const cache = createTtlCache<string>(30_000, () => now)
    cache.set('g1', 'report')
    expect(cache.get('g1')).toBe('report')
    now += 29_999
    expect(cache.get('g1')).toBe('report')
    now += 2
    expect(cache.get('g1')).toBeUndefined()
  })

  it('keeps guilds separate and returns undefined for unknown keys', () => {
    const cache = createTtlCache<string>(30_000, () => 0)
    cache.set('g1', 'a')
    expect(cache.get('g2')).toBeUndefined()
  })

  it('delete drops one key and leaves the others', () => {
    const cache = createTtlCache<string>(30_000, () => 0)
    cache.set('g1', 'a')
    cache.set('g2', 'b')
    cache.delete('g1')
    expect(cache.get('g1')).toBeUndefined()
    expect(cache.get('g2')).toBe('b')
  })
})
