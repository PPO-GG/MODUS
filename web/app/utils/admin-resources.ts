import type { ProcessMetrics, ResourcesSnapshot } from '../../server/utils/admin-resources/types'

/** 60 points at the 5s stream interval ≈ 5 minutes of sparkline. */
export const HISTORY_LENGTH = 60

export interface SeriesHistory {
  lastTs: number
  cpu: number[]
  memory: number[]
}

export interface ResourcesHistory {
  web: SeriesHistory
  shards: Record<number, SeriesHistory>
  lavalink: SeriesHistory & { streams: number[] }
}

const emptySeries = (): SeriesHistory => ({ lastTs: 0, cpu: [], memory: [] })

export function emptyHistory(): ResourcesHistory {
  return { web: emptySeries(), shards: {}, lavalink: { ...emptySeries(), streams: [] } }
}

export function pushCapped(series: number[], value: number, max = HISTORY_LENGTH): number[] {
  const next = [...series, value]
  return next.length > max ? next.slice(next.length - max) : next
}

function appendProcess(series: SeriesHistory, sample: ProcessMetrics): SeriesHistory {
  // The shared snapshot cache can hand the same sample to consecutive frames.
  if (sample.ts === series.lastTs) return series
  return {
    lastTs: sample.ts,
    cpu: pushCapped(series.cpu, sample.cpuPercent),
    memory: pushCapped(series.memory, sample.rssBytes),
  }
}

export function appendSnapshot(history: ResourcesHistory, snapshot: ResourcesSnapshot): ResourcesHistory {
  const shards: Record<number, SeriesHistory> = {}
  for (const shard of snapshot.bot.shards) {
    const previous = history.shards[shard.shardId] ?? emptySeries()
    shards[shard.shardId] = shard.status === 'live' ? appendProcess(previous, shard.sample) : previous
  }

  let lavalink = history.lavalink
  const sample = snapshot.lavalink.sample
  if (sample && sample.ts !== lavalink.lastTs) {
    lavalink = {
      lastTs: sample.ts,
      cpu: pushCapped(lavalink.cpu, sample.cpu.lavalinkLoad * 100),
      memory: pushCapped(lavalink.memory, sample.memory.used),
      streams: pushCapped(lavalink.streams, sample.playingPlayers),
    }
  }

  return { web: appendProcess(history.web, snapshot.web), shards, lavalink }
}

const round1 = (n: number): number => Math.round(n * 10) / 10

/** SVG polyline `points` for a series scaled into width×height (y inverted). */
export function sparklinePoints(values: number[], width: number, height: number, max?: number): string {
  if (values.length < 2) return ''
  const ceiling = max ?? Math.max(...values)
  const top = ceiling > 0 ? ceiling : 1
  const step = width / (values.length - 1)
  return values
    .map((value, index) => {
      const clamped = Math.min(Math.max(value, 0), top)
      return `${round1(index * step)},${round1(height - (clamped / top) * height)}`
    })
    .join(' ')
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`
}

export function formatUptime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

export function formatAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`
}

export const formatPercent = (value: number): string => `${value.toFixed(1)}%`

export function memoryRatio(used: number, total: number): number {
  if (!(total > 0)) return 0
  return Math.min(Math.max(used / total, 0), 1)
}

export function meterTone(ratio: number): 'ok' | 'warn' | 'hot' {
  if (ratio >= 0.9) return 'hot'
  if (ratio >= 0.7) return 'warn'
  return 'ok'
}
