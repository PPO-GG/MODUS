import { describe, expect, it } from 'vitest'
import {
  HISTORY_LENGTH, appendSnapshot, emptyHistory, formatAge, formatBytes, formatPercent,
  formatUptime, memoryRatio, meterTone, pushCapped, sparklinePoints,
} from './admin-resources'
import type { ResourcesSnapshot } from '../../server/utils/admin-resources/types'

const proc = (ts: number, cpu = 10, rss = 100) => ({ ts, cpuPercent: cpu, rssBytes: rss, heapUsedBytes: 1, heapTotalBytes: 2, eventLoopLagMs: 0, uptimeSeconds: 1 })
const snapshot = (over: Partial<ResourcesSnapshot> = {}): ResourcesSnapshot => ({
  generatedAt: '2026-01-01T00:00:00.000Z',
  web: proc(1),
  bot: { available: true, versionMismatch: false, shards: [] },
  lavalink: { configured: false, status: 'unavailable', sample: null, error: null },
  ...over,
})

describe('pushCapped', () => {
  it('appends without mutating and caps the length', () => {
    const original = [1, 2, 3]
    expect(pushCapped(original, 4, 3)).toEqual([2, 3, 4])
    expect(original).toEqual([1, 2, 3])
    expect(pushCapped(Array.from({ length: HISTORY_LENGTH }, (_, i) => i), 99)).toHaveLength(HISTORY_LENGTH)
  })
})

describe('appendSnapshot', () => {
  it('records web cpu/memory and ignores a repeated sample timestamp', () => {
    let history = appendSnapshot(emptyHistory(), snapshot({ web: proc(1, 10, 100) }))
    history = appendSnapshot(history, snapshot({ web: proc(1, 99, 999) }))
    history = appendSnapshot(history, snapshot({ web: proc(2, 20, 200) }))
    expect(history.web.cpu).toEqual([10, 20])
    expect(history.web.memory).toEqual([100, 200])
  })

  it('only records live shards, and drops shards that disappeared', () => {
    const shard = (shardId: number, status: 'live' | 'stale', ts: number) => ({
      shardId, status, ageMs: 0,
      sample: { ...proc(ts), source: 'bot' as const, shardId, version: '1', guilds: 1 },
    })
    let history = appendSnapshot(emptyHistory(), snapshot({
      bot: { available: true, versionMismatch: false, shards: [shard(0, 'live', 1), shard(1, 'live', 1)] },
    }))
    history = appendSnapshot(history, snapshot({
      bot: { available: true, versionMismatch: false, shards: [shard(0, 'stale', 2)] },
    }))
    expect(history.shards[0].cpu).toEqual([10]) // stale tick not recorded
    expect(history.shards[1]).toBeUndefined() // shard gone
  })

  it('records lavalink cpu (as percent), heap and streams', () => {
    const lavalink = {
      configured: true, status: 'live' as const, error: null,
      sample: { ts: 5, players: 3, playingPlayers: 2, uptimeMs: 1, cpu: { cores: 2, systemLoad: 0.5, lavalinkLoad: 0.25 }, memory: { free: 1, used: 300, allocated: 400, reservable: 800 }, frameStats: null },
    }
    const history = appendSnapshot(emptyHistory(), snapshot({ lavalink }))
    expect(history.lavalink.cpu).toEqual([25])
    expect(history.lavalink.memory).toEqual([300])
    expect(history.lavalink.streams).toEqual([2])
  })
})

describe('sparklinePoints', () => {
  it('scales into the box with y inverted', () => {
    expect(sparklinePoints([0, 50, 100], 100, 20, 100)).toBe('0,20 50,10 100,0')
  })
  it('returns empty for fewer than two points and survives an all-zero series', () => {
    expect(sparklinePoints([5], 100, 20)).toBe('')
    expect(sparklinePoints([0, 0], 100, 20)).toBe('0,20 100,20')
  })
  it('clamps values above max', () => {
    expect(sparklinePoints([0, 500], 10, 10, 100)).toBe('0,10 10,0')
  })
})

describe('formatters', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2 * 1024 ** 3)).toBe('2.0 GB')
    expect(formatBytes(Number.NaN)).toBe('—')
  })
  it('formats uptime and age', () => {
    expect(formatUptime(45)).toBe('45s')
    expect(formatUptime(720)).toBe('12m')
    expect(formatUptime(12_000)).toBe('3h 20m')
    expect(formatUptime(183_600)).toBe('2d 3h')
    expect(formatAge(4_000)).toBe('4s')
    expect(formatAge(125_000)).toBe('2m')
  })
  it('formats percent, ratio and tone', () => {
    expect(formatPercent(12.345)).toBe('12.3%')
    expect(memoryRatio(50, 100)).toBe(0.5)
    expect(memoryRatio(150, 100)).toBe(1)
    expect(memoryRatio(1, 0)).toBe(0)
    expect(meterTone(0.5)).toBe('ok')
    expect(meterTone(0.7)).toBe('warn')
    expect(meterTone(0.9)).toBe('hot')
  })
})
