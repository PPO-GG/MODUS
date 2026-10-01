import { describe, expect, it, vi } from 'vitest'
import { createResourcesService } from './service'
import type { LavalinkResult, ProcessMetrics } from './types'

const web: ProcessMetrics = { ts: 1, cpuPercent: 1, rssBytes: 1, heapUsedBytes: 1, heapTotalBytes: 1, eventLoopLagMs: 0, uptimeSeconds: 1 }

function build(over: Partial<Parameters<typeof createResourcesService>[0]> = {}) {
  const clock = { now: 1_000_000 }
  const fetchLavalink = vi.fn<() => Promise<LavalinkResult>>().mockResolvedValue({ configured: false })
  const sampleWeb = vi.fn(() => web)
  const service = createResourcesService({
    sampleWeb,
    readBotValues: async () => [],
    redisAvailable: () => true,
    fetchLavalink,
    now: () => clock.now,
    ...over,
  })
  return { service, clock, fetchLavalink, sampleWeb }
}

describe('createResourcesService', () => {
  it('shares one snapshot between callers inside the cache window', async () => {
    const { service, clock, fetchLavalink, sampleWeb } = build()
    await Promise.all([service.getSnapshot(), service.getSnapshot()])
    await service.getSnapshot()
    expect(fetchLavalink).toHaveBeenCalledTimes(1)
    expect(sampleWeb).toHaveBeenCalledTimes(1)

    clock.now += 2_500
    await service.getSnapshot()
    expect(fetchLavalink).toHaveBeenCalledTimes(2)
  })

  it('degrades to "bot unavailable" when the Redis read throws, keeping web and Lavalink', async () => {
    const { service } = build({
      readBotValues: async () => { throw new Error('redis down') },
      fetchLavalink: async () => ({ configured: false } as const),
    })
    const snap = await service.getSnapshot()
    expect(snap.bot).toEqual({ available: false, versionMismatch: false, shards: [] })
    expect(snap.web).toBe(web)
  })

  it('treats a Redis read that never settles as unavailable instead of freezing the snapshot', async () => {
    const { service } = build({
      readBotValues: () => new Promise<string[]>(() => {}), // ioredis queues forever while disconnected
      redisTimeoutMs: 20,
    })
    const snap = await service.getSnapshot()
    expect(snap.bot).toEqual({ available: false, versionMismatch: false, shards: [] })
    expect(snap.web).toBe(web)
  })

  it('does not read Redis at all when it is not configured', async () => {
    const readBotValues = vi.fn(async () => [])
    const { service } = build({ redisAvailable: () => false, readBotValues })
    const snap = await service.getSnapshot()
    expect(readBotValues).not.toHaveBeenCalled()
    expect(snap.bot.available).toBe(false)
  })
})
