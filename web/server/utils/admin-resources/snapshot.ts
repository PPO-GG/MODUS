import {
  STALE_AFTER_MS,
  isBotResourceSample,
  type BotResourceSample,
  type LavalinkResult,
  type ProcessMetrics,
  type ResourcesSnapshot,
} from './types'

export interface SnapshotInput {
  now: number
  web: ProcessMetrics
  /** Raw JSON strings read from the bot's Redis keys. */
  botValues: string[]
  redisAvailable: boolean
  lavalink: LavalinkResult
}

function parseBotSamples(values: string[]): BotResourceSample[] {
  const newest = new Map<number, BotResourceSample>()
  for (const raw of values) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    if (!isBotResourceSample(parsed)) continue
    const existing = newest.get(parsed.shardId)
    if (!existing || parsed.ts > existing.ts) newest.set(parsed.shardId, parsed)
  }
  return [...newest.values()].sort((a, b) => a.shardId - b.shardId)
}

export function buildSnapshot(input: SnapshotInput): ResourcesSnapshot {
  const samples = input.redisAvailable ? parseBotSamples(input.botValues) : []
  const shards = samples.map((sample) => {
    // Sender and receiver clocks can disagree; never report a negative age.
    const ageMs = Math.max(0, input.now - sample.ts)
    return {
      shardId: sample.shardId,
      status: ageMs > STALE_AFTER_MS ? ('stale' as const) : ('live' as const),
      ageMs,
      sample,
    }
  })

  const lavalink = input.lavalink
  return {
    generatedAt: new Date(input.now).toISOString(),
    web: input.web,
    bot: {
      available: input.redisAvailable,
      versionMismatch: new Set(samples.map((s) => s.version)).size > 1,
      shards,
    },
    lavalink: !lavalink.configured
      ? { configured: false, status: 'unavailable', sample: null, error: null }
      : lavalink.ok
        ? { configured: true, status: 'live', sample: lavalink.sample, error: null }
        : { configured: true, status: 'unavailable', sample: null, error: lavalink.error },
  }
}
