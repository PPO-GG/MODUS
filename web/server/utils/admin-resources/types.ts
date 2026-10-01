/** Keep in sync with bot/ResourceReporter.ts. */
export const RESOURCE_KEY_PREFIX = 'modus:resources:bot:'
export const STALE_AFTER_MS = 15_000
export const STREAM_INTERVAL_MS = 5_000

export interface ProcessMetrics {
  ts: number
  cpuPercent: number
  rssBytes: number
  heapUsedBytes: number
  heapTotalBytes: number
  eventLoopLagMs: number
  uptimeSeconds: number
}

export interface BotResourceSample extends ProcessMetrics {
  source: 'bot'
  shardId: number
  version: string
  guilds: number
}

export interface LavalinkSample {
  ts: number
  players: number
  playingPlayers: number
  uptimeMs: number
  cpu: { cores: number; systemLoad: number; lavalinkLoad: number }
  memory: { free: number; used: number; allocated: number; reservable: number }
  frameStats: { sent: number; nulled: number; deficit: number } | null
}

export type LavalinkResult =
  | { configured: false }
  | { configured: true; ok: true; sample: LavalinkSample }
  | { configured: true; ok: false; error: string }

export interface ResourcesSnapshot {
  generatedAt: string
  web: ProcessMetrics
  bot: {
    /** False when Redis isn't configured/reachable, so bot metrics can't be read. */
    available: boolean
    versionMismatch: boolean
    shards: Array<{
      shardId: number
      status: 'live' | 'stale'
      ageMs: number
      sample: BotResourceSample
    }>
  }
  lavalink: {
    configured: boolean
    status: 'live' | 'unavailable'
    sample: LavalinkSample | null
    /** Fixed error code only — never a URL, password, or upstream body. */
    error: string | null
  }
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export function isBotResourceSample(value: unknown): value is BotResourceSample {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    v.source === 'bot' &&
    isFiniteNumber(v.shardId) && Number.isInteger(v.shardId) && v.shardId >= 0 &&
    typeof v.version === 'string' &&
    isFiniteNumber(v.guilds) &&
    isFiniteNumber(v.ts) &&
    isFiniteNumber(v.cpuPercent) &&
    isFiniteNumber(v.rssBytes) &&
    isFiniteNumber(v.heapUsedBytes) &&
    isFiniteNumber(v.heapTotalBytes) &&
    isFiniteNumber(v.eventLoopLagMs) &&
    isFiniteNumber(v.uptimeSeconds)
  )
}
