import { describe, expect, it } from 'vitest'
import { buildSnapshot } from './snapshot'
import type { BotResourceSample, LavalinkResult, ProcessMetrics } from './types'

const NOW = 1_000_000
const web: ProcessMetrics = { ts: NOW, cpuPercent: 5, rssBytes: 1, heapUsedBytes: 1, heapTotalBytes: 2, eventLoopLagMs: 1, uptimeSeconds: 10 }
const shard = (shardId: number, over: Partial<BotResourceSample> = {}): BotResourceSample => ({
  source: 'bot', shardId, version: '1.0.0', guilds: 10, ts: NOW - 1_000,
  cpuPercent: 10, rssBytes: 100, heapUsedBytes: 50, heapTotalBytes: 80, eventLoopLagMs: 2, uptimeSeconds: 60,
  ...over,
})
const unconfigured: LavalinkResult = { configured: false }
const build = (botValues: string[], extra: Partial<Parameters<typeof buildSnapshot>[0]> = {}) =>
  buildSnapshot({ now: NOW, web, botValues, redisAvailable: true, lavalink: unconfigured, ...extra })

describe('buildSnapshot — bot shards', () => {
  it('marks a shard stale only after 15s (boundary inclusive)', () => {
    const snap = build([
      JSON.stringify(shard(0, { ts: NOW - 15_000 })),
      JSON.stringify(shard(1, { ts: NOW - 15_001 })),
    ])
    expect(snap.bot.shards.map((s) => [s.shardId, s.status, s.ageMs])).toEqual([
      [0, 'live', 15_000],
      [1, 'stale', 15_001],
    ])
  })

  it('treats a future timestamp (clock skew) as live with age 0', () => {
    const snap = build([JSON.stringify(shard(0, { ts: NOW + 9_000 }))])
    expect(snap.bot.shards[0]).toMatchObject({ status: 'live', ageMs: 0 })
  })

  it('drops invalid JSON and wrong-shaped values instead of failing', () => {
    const snap = build([
      'not json',
      '{"source":"bot","shardId":"x"}',
      JSON.stringify({ source: 'web' }),
      'null',
      JSON.stringify(shard(2)),
    ])
    expect(snap.bot.shards.map((s) => s.shardId)).toEqual([2])
  })

  it('sorts by shard id and keeps only the newest duplicate', () => {
    const snap = build([
      JSON.stringify(shard(3)),
      JSON.stringify(shard(1)),
      JSON.stringify(shard(1, { ts: NOW - 500, cpuPercent: 99 })),
    ])
    expect(snap.bot.shards.map((s) => s.shardId)).toEqual([1, 3])
    expect(snap.bot.shards[0].sample.cpuPercent).toBe(99)
  })

  it('flags version disagreement across shards', () => {
    expect(build([JSON.stringify(shard(0)), JSON.stringify(shard(1))]).bot.versionMismatch).toBe(false)
    expect(build([JSON.stringify(shard(0)), JSON.stringify(shard(1, { version: '1.1.0' }))]).bot.versionMismatch).toBe(true)
  })

  it('reports bot metrics unavailable when Redis is not available', () => {
    const snap = build([], { redisAvailable: false })
    expect(snap.bot).toEqual({ available: false, versionMismatch: false, shards: [] })
  })
})

describe('buildSnapshot — lavalink and envelope', () => {
  it('maps configured/ok/error states', () => {
    expect(build([]).lavalink).toEqual({ configured: false, status: 'unavailable', sample: null, error: null })
    expect(build([], { lavalink: { configured: true, ok: false, error: 'timeout' } }).lavalink)
      .toEqual({ configured: true, status: 'unavailable', sample: null, error: 'timeout' })
    const sample = { ts: NOW, players: 1, playingPlayers: 1, uptimeMs: 5, cpu: { cores: 2, systemLoad: 0.1, lavalinkLoad: 0.05 }, memory: { free: 1, used: 2, allocated: 3, reservable: 4 }, frameStats: null }
    expect(build([], { lavalink: { configured: true, ok: true, sample } }).lavalink)
      .toEqual({ configured: true, status: 'live', sample, error: null })
  })

  it('stamps generatedAt and passes web through', () => {
    const snap = build([])
    expect(snap.generatedAt).toBe(new Date(NOW).toISOString())
    expect(snap.web).toBe(web)
  })
})
