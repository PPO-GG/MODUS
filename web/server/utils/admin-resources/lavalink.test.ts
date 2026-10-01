import { describe, expect, it } from 'vitest'
import { fetchLavalinkStats, lavalinkStatsUrl, parseLavalinkStats } from './lavalink'

const stats = {
  players: 4,
  playingPlayers: 2,
  uptime: 123_456,
  memory: { free: 100, used: 400, allocated: 500, reservable: 1000 },
  cpu: { cores: 4, systemLoad: 0.25, lavalinkLoad: 0.1 },
  frameStats: { sent: 6000, nulled: 5, deficit: -3 },
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('lavalinkStatsUrl', () => {
  it('swaps /version for /v4/stats', () => {
    expect(lavalinkStatsUrl('http://lavalink:2333/version')).toBe('http://lavalink:2333/v4/stats')
  })
  it('keeps a path prefix', () => {
    expect(lavalinkStatsUrl('https://example.com/lavalink/version')).toBe('https://example.com/lavalink/v4/stats')
  })
  it('returns null for garbage', () => {
    expect(lavalinkStatsUrl('not a url')).toBeNull()
  })
})

describe('parseLavalinkStats', () => {
  it('maps a v4 stats payload', () => {
    expect(parseLavalinkStats(stats, 5)).toEqual({
      ts: 5,
      players: 4,
      playingPlayers: 2,
      uptimeMs: 123_456,
      cpu: { cores: 4, systemLoad: 0.25, lavalinkLoad: 0.1 },
      memory: { free: 100, used: 400, allocated: 500, reservable: 1000 },
      frameStats: { sent: 6000, nulled: 5, deficit: -3 },
    })
  })

  it('maps frameStats: null (idle node) to null', () => {
    expect(parseLavalinkStats({ ...stats, frameStats: null }, 5)?.frameStats).toBeNull()
  })

  it('rejects a payload missing required fields', () => {
    expect(parseLavalinkStats({ players: 1 }, 5)).toBeNull()
    expect(parseLavalinkStats(null, 5)).toBeNull()
    expect(parseLavalinkStats({ ...stats, players: 'many' }, 5)).toBeNull()
  })
})

describe('fetchLavalinkStats', () => {
  const base = { versionUrl: 'http://lavalink:2333/version', password: 'secret-pw', now: () => 99 }

  it('requests /v4/stats with the raw password header and maps the result', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const result = await fetchLavalinkStats({
      ...base,
      fetchImpl: async (url, init) => {
        calls.push({ url, init })
        return json(stats)
      },
    })
    expect(calls[0].url).toBe('http://lavalink:2333/v4/stats')
    expect(calls[0].init?.headers).toEqual({ Authorization: 'secret-pw' })
    expect(result).toEqual({ configured: true, ok: true, sample: parseLavalinkStats(stats, 99) })
  })

  it('is unconfigured without a URL', async () => {
    const result = await fetchLavalinkStats({ ...base, versionUrl: '', fetchImpl: async () => json(stats) })
    expect(result).toEqual({ configured: false })
  })

  it('maps failures to fixed codes that never contain the URL or password', async () => {
    const run = (fetchImpl: (u: string, i?: RequestInit) => Promise<Response>, extra = {}) =>
      fetchLavalinkStats({ ...base, fetchImpl, ...extra })

    expect(await run(async () => json({}, 401))).toEqual({ configured: true, ok: false, error: 'unauthorized' })
    expect(await run(async () => json({}, 500))).toEqual({ configured: true, ok: false, error: 'http_500' })
    expect(await run(async () => new Response('<html>', { status: 200 }))).toEqual({ configured: true, ok: false, error: 'invalid_response' })
    expect(await run(async () => json({ players: 1 }))).toEqual({ configured: true, ok: false, error: 'invalid_response' })

    const network = await run(async () => { throw new Error('connect ECONNREFUSED lavalink:2333 secret-pw') })
    expect(network).toEqual({ configured: true, ok: false, error: 'network' })
    expect(JSON.stringify(network)).not.toContain('secret-pw')
    expect(JSON.stringify(network)).not.toContain('lavalink')
  })

  it('times out', async () => {
    const result = await fetchLavalinkStats({
      ...base,
      timeoutMs: 10,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
        }),
    })
    expect(result).toEqual({ configured: true, ok: false, error: 'timeout' })
  })
})
