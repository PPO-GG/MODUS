import { describe, expect, it, vi } from 'vitest'
import { createResourcesFeed, type EventSourceLike } from './admin-resources-feed'
import type { ResourcesSnapshot } from '../../server/utils/admin-resources/types'

const snapshot = { generatedAt: 'x' } as unknown as ResourcesSnapshot

class FakeSource implements EventSourceLike {
  readyState = 0
  onopen: ((e: unknown) => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  close = vi.fn(() => { this.readyState = 2 })
}

function build(over: { fetchSnapshot?: () => Promise<ResourcesSnapshot> } = {}) {
  const sources: FakeSource[] = []
  const timers: Array<{ fn: () => void; ms: number; cancelled: boolean }> = []
  const onSnapshot = vi.fn()
  const onConnection = vi.fn()
  const onLoadError = vi.fn()
  const feed = createResourcesFeed({
    fetchSnapshot: over.fetchSnapshot ?? (async () => snapshot),
    createSource: () => {
      const source = new FakeSource()
      sources.push(source)
      return source
    },
    onSnapshot,
    onConnection,
    onLoadError,
    schedule: (fn, ms) => {
      const timer = { fn, ms, cancelled: false }
      timers.push(timer)
      return () => { timer.cancelled = true }
    },
  })
  return { feed, sources, timers, onSnapshot, onConnection, onLoadError }
}

describe('createResourcesFeed', () => {
  it('does not open a stream when disposed while the first load is still in flight', async () => {
    let resolveLoad!: (value: ResourcesSnapshot) => void
    const { feed, sources } = build({
      fetchSnapshot: () => new Promise<ResourcesSnapshot>((resolve) => { resolveLoad = resolve }),
    })
    const started = feed.start()
    feed.dispose() // the user navigated away before the load finished
    resolveLoad(snapshot)
    await started
    expect(sources).toHaveLength(0)
  })

  it('applies stream frames, marks live, and ignores a malformed frame', async () => {
    const { feed, sources, onSnapshot, onConnection } = build()
    await feed.start()
    onSnapshot.mockClear()

    sources[0].onopen?.({})
    expect(onConnection).toHaveBeenLastCalledWith('live')

    sources[0].onmessage?.({ data: '{not json' })
    expect(onSnapshot).not.toHaveBeenCalled()

    sources[0].onmessage?.({ data: JSON.stringify({ generatedAt: 'y' }) })
    expect(onSnapshot).toHaveBeenCalledWith({ generatedAt: 'y' })
  })

  it('leaves transient network errors to the browser retry', async () => {
    const { feed, sources, timers, onConnection } = build()
    await feed.start()
    sources[0].readyState = 0 // CONNECTING: EventSource is retrying by itself
    sources[0].onerror?.({})
    expect(onConnection).toHaveBeenLastCalledWith('reconnecting')
    expect(timers).toHaveLength(0)
    expect(sources[0].close).not.toHaveBeenCalled()
  })

  it('reopens with growing backoff when the browser gave up (proxy 502, expired session)', async () => {
    const { feed, sources, timers, onConnection } = build()
    await feed.start()

    sources[0].readyState = 2 // CLOSED for good
    sources[0].onerror?.({})
    expect(onConnection).toHaveBeenLastCalledWith('reconnecting')
    expect(timers.map((t) => t.ms)).toEqual([5_000])

    timers[0].fn()
    expect(sources).toHaveLength(2)
    sources[1].readyState = 2
    sources[1].onerror?.({})
    expect(timers.map((t) => t.ms)).toEqual([5_000, 10_000])

    timers[1].fn()
    sources[2].onopen?.({}) // a successful connection resets the backoff
    sources[2].readyState = 2
    sources[2].onerror?.({})
    expect(timers[2].ms).toBe(5_000)
  })

  it('dispose closes the stream and cancels a pending reconnect', async () => {
    const { feed, sources, timers } = build()
    await feed.start()
    sources[0].readyState = 2
    sources[0].onerror?.({})
    feed.dispose()
    expect(timers[0].cancelled).toBe(true)

    const { feed: other, sources: otherSources } = build()
    await other.start()
    other.dispose()
    expect(otherSources[0].close).toHaveBeenCalled()
  })

  it('reports a failed first load and still opens the stream', async () => {
    const { feed, sources, onLoadError } = build({ fetchSnapshot: async () => { throw new Error('nope') } })
    await feed.start()
    expect(onLoadError).toHaveBeenCalledTimes(1)
    expect(sources).toHaveLength(1)
  })
})
