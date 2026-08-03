import { useEffect, useState } from 'react'

/**
 * Decides whether `HassConnect` may mount.
 *
 * `HassConnect` renders its own failure screen, and that screen *replaces the
 * whole dashboard* — a stale token means no clock, no calendar, no music, just
 * `ERR_INVALID_AUTH` on the kitchen wall. So the question this has to answer is
 * not "is HA up?" but "will the handshake succeed?", and it has to answer it
 * before HassConnect is given the chance to try.
 *
 * It asks over the WebSocket, for two reasons. Home Assistant only sends
 * `Access-Control-Allow-Origin` for origins listed in its
 * `http.cors_allowed_origins`, so an ordinary `fetch` probe is rejected unread
 * from any other origin — a healthy HA and a dead one look identical, which is
 * how the dev server silently lost every HA-backed widget. And the WebSocket
 * handshake reports token validity as well as reachability, which is the pair
 * that actually determines whether HassConnect works. It is not CORS-gated.
 *
 * Exported for its own test: getting this wrong is invisible in one direction
 * (widgets quietly vanish) and catastrophic in the other (the dashboard is
 * replaced by an error screen).
 */
export function useHaUsable(url: string | undefined, token: string | undefined): boolean {
  const [usable, setUsable] = useState(false)

  useEffect(() => {
    if (!url || !token) return

    let socket: WebSocket | null = null
    let settled = false

    const finish = (ok: boolean, why?: string) => {
      if (settled) return
      settled = true
      if (!ok && why) console.warn(`[ha] ${why} — continuing without Home Assistant`)
      setUsable(ok)
      // The probe is a question, not a subscription: HassConnect opens the
      // connection it actually uses. Leaving this one open would double every
      // socket against HA.
      try {
        socket?.close()
      } catch {
        /* already gone */
      }
    }

    try {
      socket = new WebSocket(`${url.replace(/^http/, 'ws')}/api/websocket`)
    } catch {
      finish(false, 'could not open a socket')
      return
    }

    socket.onmessage = (event: MessageEvent) => {
      let message: { type?: string; message?: string }
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (message.type === 'auth_required')
        socket?.send(JSON.stringify({ type: 'auth', access_token: token }))
      else if (message.type === 'auth_ok') finish(true)
      else if (message.type === 'auth_invalid')
        finish(false, message.message ?? 'authentication rejected')
    }
    socket.onerror = () => finish(false, 'unreachable')

    const timer = setTimeout(() => finish(false, 'no answer'), 5000)

    return () => {
      clearTimeout(timer)
      settled = true
      try {
        socket?.close()
      } catch {
        /* already gone */
      }
    }
  }, [url, token])

  return usable
}
