import { isRealtimeAvailable, readStoredValues } from '../eventbus'
import { fetchLavalinkStats } from './lavalink'
import { createProcessSampler } from './process-sampler'
import { createResourcesService } from './service'
import { RESOURCE_KEY_PREFIX } from './types'

let service: ReturnType<typeof createResourcesService> | null = null

/** Process-wide singleton so the CPU sampler baseline and snapshot cache are shared. */
export function getResourcesService() {
  if (service) return service

  const config = useRuntimeConfig()
  const lavalinkVersionUrl = (config.lavalinkVersionUrl as string) || ''
  const lavalinkPassword = (config.lavalinkPassword as string) || undefined

  service = createResourcesService({
    sampleWeb: createProcessSampler(),
    readBotValues: () => readStoredValues(RESOURCE_KEY_PREFIX),
    redisAvailable: isRealtimeAvailable,
    fetchLavalink: () =>
      fetchLavalinkStats({
        versionUrl: lavalinkVersionUrl,
        password: lavalinkPassword,
        fetchImpl: fetch,
      }),
    now: () => Date.now(),
  })
  return service
}
