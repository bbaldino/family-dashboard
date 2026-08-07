import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useHealthServices, useIncidents, useServiceUptime } from './useHealth'
import type { Service } from './types'

/**
 * The reads go through `healthIntegration.api`, which prefixes `/api/health`.
 * Two things have to hold across that move.
 *
 * The composed URLs must not drift — the paths and their query strings are the
 * contract with the Rust proxy (`backend/src/integrations/health/mod.rs`), and
 * a hook that composes `/api/health/api/health/...` or drops `?window=` still
 * type-checks perfectly.
 *
 * And a failed request must still reach the caller as a failure. That was
 * `fetchJson`'s entire reason for existing: `fetch` only rejects on a network
 * error, so a 400 resolves and `.json()` parses the *error body* — which the
 * ledger then held as if it were an incident array, either throwing on
 * `.slice` or drawing a clean week over a failed request. The guard now lives
 * in `apiRequest`'s `resp.ok` branch; these tests are what says it is still
 * there.
 */

/** Full enough for `apiRequest`, which reads `ok`, `status` and then `text`. */
function stubFetch(status: number, body: unknown) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      calls.push(String(input))
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
      } as Response)
    }),
  )
  return calls
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

const SERVICES: Service[] = [{ id: 7, name: 'Unraid', status: 'ok' } as Service]

afterEach(() => vi.unstubAllGlobals())

describe('health reads', () => {
  it('asks for /status under the integration prefix', async () => {
    const calls = stubFetch(200, [])
    const { result } = renderHook(() => useHealthServices(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(calls).toEqual(['/api/health/status'])
  })

  it('keeps the per-service uptime window in the query string', async () => {
    // A segment is required, not decoration: `windowEndOf` anchors the bar to
    // the newest segment, and an empty report yields a blank bar with a null
    // `percentOk` — indistinguishable from "not loaded yet".
    const calls = stubFetch(200, {
      window_secs: 86_400,
      percent_ok: 100,
      segments: [{ status: 'ok', start: 1_700_000_000, end: 1_700_086_400 }],
    })
    const { result } = renderHook(() => useServiceUptime(SERVICES), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current[7].percentOk).not.toBeNull())
    expect(calls).toEqual(['/api/health/uptime/7?window=86400'])
  })

  it('passes the ledger its row cap and nothing else', async () => {
    const calls = stubFetch(200, [])
    const { result } = renderHook(() => useIncidents(40), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(calls).toEqual(['/api/health/incidents?limit=40'])
  })

  /** The bug `fetchJson` was written to prevent, now guarded by `apiRequest`:
   *  homelab-health v0.3.1 returns 400 for a malformed window where it used to
   *  return `200 []`. The error body must never arrive as data. */
  it('surfaces a 400 as an error rather than handing back the parsed error body', async () => {
    stubFetch(400, { error: 'since looks like milliseconds' })
    const { result } = renderHook(() => useIncidents(40), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
    expect(result.current.error?.message).toMatch(/milliseconds/)
  })

  it('still fails when the error body carries no message', async () => {
    stubFetch(500, {})
    const { result } = renderHook(() => useHealthServices(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.data).toBeUndefined()
    expect(result.current.error?.message).toMatch(/500/)
  })
})
