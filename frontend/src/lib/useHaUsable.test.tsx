import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useHaUsable } from './useHaUsable'

/**
 * The gate in front of `HassConnect`, which owns its own failure screen: if it
 * mounts and the handshake fails, that screen *replaces the entire dashboard*.
 * So this has to answer the real question — "will HassConnect succeed?" —
 * before it is allowed to try.
 *
 * A plain `fetch` cannot answer it. Home Assistant only sends
 * `Access-Control-Allow-Origin` for origins in its `http.cors_allowed_origins`,
 * so from anywhere else the browser rejects the response unread and a healthy
 * HA is indistinguishable from a dead one. The WebSocket is not CORS-gated and
 * reports both reachability and token validity, which is exactly the pair that
 * decides whether HassConnect can work.
 */
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  onclose: (() => void) | null = null
  sent: string[] = []
  closed = false
  url: string

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.closed = true
  }
  /** Drive the server side of HA's handshake. */
  serverSays(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

describe('useHaUsable', () => {
  beforeEach(() => {
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
  })
  afterEach(() => vi.unstubAllGlobals())

  const latest = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1]

  it('is usable once the token is accepted', async () => {
    const { result } = renderHook(() => useHaUsable('http://ha.local:8123', 'good-token'))

    latest().serverSays({ type: 'auth_required' })
    expect(JSON.parse(latest().sent[0])).toEqual({ type: 'auth', access_token: 'good-token' })

    latest().serverSays({ type: 'auth_ok' })

    await waitFor(() => expect(result.current).toBe(true))
  })

  /** The case that blanked the dashboard: HA up, token stale. Before, the
   *  CORS-blocked probe accidentally hid this; the moment the probe was fixed,
   *  HassConnect mounted and rendered ERR_INVALID_AUTH over everything. */
  it('is not usable when the token is rejected', async () => {
    const { result } = renderHook(() => useHaUsable('http://ha.local:8123', 'stale-token'))

    latest().serverSays({ type: 'auth_required' })
    latest().serverSays({ type: 'auth_invalid', message: 'Invalid access token' })

    await new Promise((r) => setTimeout(r, 20))
    expect(result.current).toBe(false)
  })

  it('is not usable when the socket fails outright', async () => {
    const { result } = renderHook(() => useHaUsable('http://ha.local:8123', 'good-token'))

    latest().onerror?.()

    await new Promise((r) => setTimeout(r, 20))
    expect(result.current).toBe(false)
  })

  it('uses a wss socket for an https instance', () => {
    renderHook(() => useHaUsable('https://ha.example.com', 'good-token'))

    expect(latest().url).toBe('wss://ha.example.com/api/websocket')
  })

  it('stays false with nothing configured', async () => {
    const { result } = renderHook(() => useHaUsable(undefined, undefined))

    await new Promise((r) => setTimeout(r, 20))
    expect(result.current).toBe(false)
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  /** The probe's own socket is a check, not a subscription — `HassConnect`
   *  opens the real one. Leaving it open would double every connection. */
  it('closes its probe socket once it has an answer', async () => {
    const { result } = renderHook(() => useHaUsable('http://ha.local:8123', 'good-token'))

    latest().serverSays({ type: 'auth_required' })
    latest().serverSays({ type: 'auth_ok' })

    await waitFor(() => expect(result.current).toBe(true))
    expect(latest().closed).toBe(true)
  })
})
