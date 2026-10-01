import type { ResourcesSnapshot } from '../../server/utils/admin-resources/types'

export type ResourcesConnection = 'connecting' | 'live' | 'reconnecting'

/** The slice of EventSource the feed needs, so it can be driven by a fake in tests. */
export interface EventSourceLike {
  readyState: number
  onopen: ((event: unknown) => void) | null
  onmessage: ((event: { data: string }) => void) | null
  onerror: ((event: unknown) => void) | null
  close(): void
}

export interface ResourcesFeedDeps {
  fetchSnapshot: () => Promise<ResourcesSnapshot>
  createSource: () => EventSourceLike
  onSnapshot: (snapshot: ResourcesSnapshot) => void
  onConnection: (state: ResourcesConnection) => void
  onLoadError: () => void
  /** Runs `fn` after `ms`; returns a cancel function. */
  schedule: (fn: () => void, ms: number) => () => void
  backoffMs?: number[]
}

const CLOSED = 2
const DEFAULT_BACKOFF_MS = [5_000, 10_000, 30_000]

/**
 * Lifecycle of the resources stream, kept free of Vue so it is testable.
 *
 * - `start()` seeds from one JSON fetch, then opens the stream — unless the
 *   page was disposed while the fetch was in flight (otherwise that stream
 *   would be opened after unmount and never closed).
 * - EventSource retries network errors itself, but a non-200 / non-SSE reply
 *   (a proxy 502 during a redeploy, an expired session) closes it for good.
 *   In that case we reopen with a growing backoff instead of staying on
 *   "Reconnecting" forever.
 */
export function createResourcesFeed(deps: ResourcesFeedDeps) {
  const backoff = deps.backoffMs ?? DEFAULT_BACKOFF_MS
  let disposed = false
  let source: EventSourceLike | null = null
  let cancelRetry: (() => void) | null = null
  let attempt = 0

  function open() {
    if (disposed) return
    const current = deps.createSource()
    source = current

    current.onopen = () => {
      attempt = 0
      deps.onConnection('live')
    }
    current.onmessage = (event) => {
      let parsed: ResourcesSnapshot
      try {
        parsed = JSON.parse(event.data) as ResourcesSnapshot
      } catch {
        return // ignore a malformed frame; the next one replaces it
      }
      deps.onSnapshot(parsed)
      deps.onConnection('live')
    }
    current.onerror = () => {
      deps.onConnection('reconnecting')
      if (current.readyState === CLOSED && !disposed) {
        current.close()
        source = null
        const delay = backoff[Math.min(attempt, backoff.length - 1)]
        attempt++
        cancelRetry = deps.schedule(() => {
          cancelRetry = null
          open()
        }, delay)
      }
    }
  }

  async function start() {
    try {
      deps.onSnapshot(await deps.fetchSnapshot())
    } catch {
      deps.onLoadError()
    }
    open()
  }

  function dispose() {
    disposed = true
    cancelRetry?.()
    cancelRetry = null
    source?.close()
    source = null
  }

  return { start, dispose }
}
