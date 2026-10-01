import { PromiseTtlCache, withTimeout } from '../admin-operations/cache'
import { buildSnapshot } from './snapshot'
import type { LavalinkResult, ProcessMetrics, ResourcesSnapshot } from './types'

const DEFAULT_CACHE_TTL_MS = 2_000
// ioredis is configured to queue commands forever while disconnected, so an
// unbounded Redis read would freeze the whole snapshot (web + Lavalink too).
const DEFAULT_REDIS_TIMEOUT_MS = 2_000

export interface ResourcesServiceDeps {
  sampleWeb: () => ProcessMetrics
  readBotValues: () => Promise<string[]>
  redisAvailable: () => boolean
  fetchLavalink: () => Promise<LavalinkResult>
  now: () => number
  cacheTtlMs?: number
  redisTimeoutMs?: number
}

/**
 * One shared snapshot per ~2s so several open admin tabs (and the one-shot
 * route) don't each hit Lavalink, Redis, and the CPU sampler. Sampling the web
 * process through this also keeps the CPU window from collapsing to a few ms.
 */
export function createResourcesService(deps: ResourcesServiceDeps) {
  const cache = new PromiseTtlCache<string, ResourcesSnapshot>(deps.now)

  return {
    getSnapshot(): Promise<ResourcesSnapshot> {
      return cache.getOrCreate('snapshot', deps.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS, async () => {
        let redisAvailable = deps.redisAvailable()
        let botValues: string[] = []
        const lavalinkPromise = deps.fetchLavalink()
        if (redisAvailable) {
          try {
            botValues = await withTimeout(
              () => deps.readBotValues(),
              deps.redisTimeoutMs ?? DEFAULT_REDIS_TIMEOUT_MS,
            )
          } catch {
            redisAvailable = false
          }
        }
        return buildSnapshot({
          now: deps.now(),
          web: deps.sampleWeb(),
          botValues,
          redisAvailable,
          lavalink: await lavalinkPromise,
        })
      })
    },
  }
}
