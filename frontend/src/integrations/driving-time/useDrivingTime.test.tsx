import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useDrivingTime, formatDuration } from './useDrivingTime'
import type { CalendarEvent } from '@/integrations/google-calendar'

/**
 * Pins the composed `/api/fetch` request this hook sends to Google's Routes
 * API — both `X-Goog-*` headers and the full body — and confirms the hook
 * never fires that request until *both* config sources (`driving-time.*`
 * and the `google-cloud` provider's `api_key`) have resolved. The duration
 * text formatting (the deleted Rust route's exact branches) is pinned
 * separately against `formatDuration` directly, and the leave-by/urgency
 * math is unchanged from before the migration so isn't re-pinned here.
 */

const FULL_CONFIG = {
  'driving-time.home_address': '1 Infinite Loop, Cupertino, CA',
  'driving-time.buffer_minutes': '5',
  'google-cloud.api_key': 'test-api-key',
}

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes'

function makeEvent(id: string, minutesFromNow: number, location: string): CalendarEvent {
  const start = new Date(Date.now() + minutesFromNow * 60000)
  return {
    id,
    summary: id,
    start: { dateTime: start.toISOString() },
    end: { dateTime: start.toISOString() },
    location,
  }
}

function stubFetch(opts: {
  configData?: Record<string, string>
  configPromise?: Promise<unknown>
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    // `init` isn't read here — the request-shape test inspects it directly
    // off `fetchMock.mock.calls`, which is why it stays in the signature (so
    // the mock's call tuples type as `[input, init]` instead of `[input]`).
    void init
    const url = String(input)
    if (url === '/api/config') {
      if (opts.configPromise) await opts.configPromise
      return { ok: true, json: async () => opts.configData ?? FULL_CONFIG } as Response
    }
    if (url === '/api/fetch') {
      return {
        ok: true,
        text: async () => JSON.stringify({ routes: [{ duration: '650s' }] }),
      } as Response
    }
    throw new Error(`Unexpected fetch url: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('formatDuration', () => {
  it('rounds sub-minute durations up to 1 minute rather than 0', () => {
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDuration(59)).toBe('1 min')
  })

  it('formats exact and partial hours', () => {
    expect(formatDuration(3600)).toBe('1 hr')
    expect(formatDuration(3660)).toBe('1 hr 1 min')
    expect(formatDuration(7200)).toBe('2 hr')
  })
})

describe('useDrivingTime', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('composes the Routes API request with both headers and the full body', async () => {
    const fetchMock = stubFetch({})
    const events = [makeEvent('evt-1', 60, '1 Apple Park Way, Cupertino, CA')]

    renderHook(() => useDrivingTime(events), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/fetch')).toBe(true)
    })

    const call = fetchMock.mock.calls.find(([input]) => String(input) === '/api/fetch')!
    const body = JSON.parse((call[1] as RequestInit).body as string)

    expect(body).toEqual({
      url: ROUTES_URL,
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': 'test-api-key',
        'X-Goog-FieldMask': 'routes.duration',
      },
      body: {
        origin: { address: '1 Infinite Loop, Cupertino, CA' },
        destination: { address: '1 Apple Park Way, Cupertino, CA' },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      },
      ttl_secs: 300,
    })
  })

  it('does not fire while either config source is still unresolved', async () => {
    let resolveConfig!: () => void
    const configPromise = new Promise<void>((resolve) => {
      resolveConfig = resolve
    })
    const fetchMock = stubFetch({ configPromise })
    const events = [makeEvent('evt-1', 60, '1 Apple Park Way, Cupertino, CA')]

    renderHook(() => useDrivingTime(events), { wrapper: createWrapper() })

    // Give pending microtasks a chance to run without resolving /api/config.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/fetch')).toBe(false)

    await act(async () => {
      resolveConfig()
    })

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/fetch')).toBe(true)
    })
  })
})
