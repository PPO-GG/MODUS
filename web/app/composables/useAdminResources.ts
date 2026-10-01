import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { ResourcesSnapshot } from '../../server/utils/admin-resources/types'
import { appendSnapshot, emptyHistory, type ResourcesHistory } from '~/utils/admin-resources'
import { createResourcesFeed, type ResourcesConnection } from '~/utils/admin-resources-feed'

export type { ResourcesConnection }

/**
 * Seeds the page with one JSON fetch (so auth/Redis errors surface cleanly),
 * then follows the SSE stream. The connection lifecycle (reconnect backoff,
 * cleanup when the page is left mid-load) lives in `createResourcesFeed`.
 * While the stream is down we keep the last values and report `reconnecting`
 * so the page can mark them stale.
 */
export function useAdminResources() {
  const snapshot = shallowRef<ResourcesSnapshot | null>(null)
  const history = shallowRef<ResourcesHistory>(emptyHistory())
  const connection = ref<ResourcesConnection>('connecting')
  const error = ref<string | null>(null)

  const fetchSnapshot = () => $fetch<ResourcesSnapshot>('/api/admin/resources')

  function apply(next: ResourcesSnapshot) {
    snapshot.value = next
    history.value = appendSnapshot(history.value, next)
    error.value = null
  }

  const feed = createResourcesFeed({
    fetchSnapshot,
    createSource: () => new EventSource('/api/admin/resources/stream'),
    onSnapshot: apply,
    onConnection: (state) => {
      connection.value = state
    },
    onLoadError: () => {
      error.value = 'Resource usage could not be loaded.'
    },
    schedule: (fn, ms) => {
      const timer = setTimeout(fn, ms)
      return () => clearTimeout(timer)
    },
  })

  async function refresh() {
    try {
      apply(await fetchSnapshot())
    } catch {
      error.value = 'Resource usage could not be loaded.'
    }
  }

  onMounted(() => {
    void feed.start()
  })
  onUnmounted(feed.dispose)

  return { snapshot, history, connection, error, refresh }
}
