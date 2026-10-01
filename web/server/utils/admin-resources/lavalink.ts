import type { LavalinkResult, LavalinkSample } from './types'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface LavalinkStatsDeps {
  versionUrl: string
  password?: string
  fetchImpl: FetchLike
  now?: () => number
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 4_000

/** Derives `<base>/v4/stats` from the configured `<base>/version` probe URL. */
export function lavalinkStatsUrl(versionUrl: string): string | null {
  try {
    const url = new URL(versionUrl)
    url.search = ''
    url.hash = ''
    url.pathname = `${url.pathname.replace(/\/version\/?$/, '').replace(/\/$/, '')}/v4/stats`
    return url.toString()
  } catch {
    return null
  }
}

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

/** Maps a Lavalink v4 `/v4/stats` body; null when any required field is missing. */
export function parseLavalinkStats(value: unknown, ts: number): LavalinkSample | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, any>

  const players = num(v.players)
  const playingPlayers = num(v.playingPlayers)
  const uptimeMs = num(v.uptime)
  const cores = num(v.cpu?.cores)
  const systemLoad = num(v.cpu?.systemLoad)
  const lavalinkLoad = num(v.cpu?.lavalinkLoad)
  const free = num(v.memory?.free)
  const used = num(v.memory?.used)
  const allocated = num(v.memory?.allocated)
  const reservable = num(v.memory?.reservable)

  if (
    players === null || playingPlayers === null || uptimeMs === null ||
    cores === null || systemLoad === null || lavalinkLoad === null ||
    free === null || used === null || allocated === null || reservable === null
  ) {
    return null
  }

  // Lavalink sends frameStats: null while nothing is playing.
  const sent = num(v.frameStats?.sent)
  const nulled = num(v.frameStats?.nulled)
  const deficit = num(v.frameStats?.deficit)
  const frameStats =
    sent !== null && nulled !== null && deficit !== null ? { sent, nulled, deficit } : null

  return {
    ts,
    players,
    playingPlayers,
    uptimeMs,
    cpu: { cores, systemLoad, lavalinkLoad },
    memory: { free, used, allocated, reservable },
    frameStats,
  }
}

/**
 * Never throws. Failures come back as fixed codes only (timeout, unauthorized,
 * network, invalid_response, http_<n>) so the URL, password, or an upstream
 * body can't leak into the response or logs.
 */
export async function fetchLavalinkStats(deps: LavalinkStatsDeps): Promise<LavalinkResult> {
  const statsUrl = deps.versionUrl ? lavalinkStatsUrl(deps.versionUrl) : null
  if (!statsUrl) return { configured: false }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    // Lavalink v4 auth is the raw password in Authorization — no "Bearer".
    const response = await deps.fetchImpl(statsUrl, {
      signal: controller.signal,
      headers: deps.password ? { Authorization: deps.password } : undefined,
    })
    if (response.status === 401 || response.status === 403) {
      return { configured: true, ok: false, error: 'unauthorized' }
    }
    if (!response.ok) {
      return { configured: true, ok: false, error: `http_${response.status}` }
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      return { configured: true, ok: false, error: controller.signal.aborted ? 'timeout' : 'invalid_response' }
    }
    const sample = parseLavalinkStats(body, (deps.now ?? Date.now)())
    return sample
      ? { configured: true, ok: true, sample }
      : { configured: true, ok: false, error: 'invalid_response' }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return { configured: true, ok: false, error: aborted ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
  }
}
