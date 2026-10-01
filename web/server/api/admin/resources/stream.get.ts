/**
 * SSE stream of the admin Resources snapshot.
 *
 * Route: GET /api/admin/resources/stream — bot admins only.
 *
 * A dedicated route (rather than a channel in /api/events/[channel]) because
 * the snapshot merges non-Redis sources: the web process itself and a direct
 * Lavalink poll. Sampling only runs while at least one client is connected.
 * Heartbeat comments every 25s keep proxies from closing an idle stream; the
 * browser's EventSource reconnects on its own if the stream drops.
 */
import { getResourcesService } from '../../../utils/admin-resources/runtime'
import { STREAM_INTERVAL_MS } from '../../../utils/admin-resources/types'
import { requireBotAdmin } from '../../../utils/session'

const HEARTBEAT_MS = 25_000

export default defineEventHandler(async (event) => {
  await requireBotAdmin(event)

  const res = event.node.res
  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-transform')
  setResponseHeader(event, 'Connection', 'keep-alive')
  // Stops nginx (and compatible proxies) from buffering the stream.
  setResponseHeader(event, 'X-Accel-Buffering', 'no')
  res.flushHeaders?.()
  res.write(': connected\n\n')

  const service = getResourcesService()
  let closed = false
  let timer: NodeJS.Timeout | null = null

  const push = async () => {
    try {
      const snapshot = await service.getSnapshot()
      if (!closed) res.write(`data: ${JSON.stringify(snapshot)}\n\n`)
    } catch (error) {
      console.warn(
        `[Admin Resources] snapshot failed (${error instanceof Error ? error.name : 'UnknownError'}).`,
      )
    }
  }

  const loop = async () => {
    await push()
    if (!closed) timer = setTimeout(loop, STREAM_INTERVAL_MS)
  }
  void loop()

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n')
    } catch {
      clearInterval(heartbeat)
    }
  }, HEARTBEAT_MS)
  heartbeat.unref?.()

  const cleanup = () => {
    closed = true
    if (timer) clearTimeout(timer)
    clearInterval(heartbeat)
    try {
      res.end()
    } catch {
      // already closed
    }
  }
  event.node.req.on('close', cleanup)
  event.node.req.on('aborted', cleanup)

  // Keep the handler alive until the client disconnects.
  return new Promise<void>((resolve) => {
    event.node.req.on('close', () => resolve())
  })
})
