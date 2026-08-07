import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useDrivingTime, formatDuration } from './useDrivingTime'
import { drivingTimeIntegration } from './config'
import type { CalendarEvent } from '@/providers/google-calendar'

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
  /** Per-destination-address duration, for the multi-destination tests. A
   *  `null` stands for an upstream failure of that one destination. */
  durationsByDestination?: Record<string, string | null>
}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/config') {
      if (opts.configPromise) await opts.configPromise
      return { ok: true, json: async () => opts.configData ?? FULL_CONFIG } as Response
    }
    if (url === '/api/fetch') {
      // The request-shape test inspects `init` off `fetchMock.mock.calls`
      // rather than here; the fan-out tests need the destination to decide
      // what to answer, which is the only reason this reads the body.
      const sent = JSON.parse((init?.body as string) ?? '{}')
      const destination = sent.body?.destination?.address as string | undefined
      const duration =
        destination && opts.durationsByDestination
          ? opts.durationsByDestination[destination]
          : '650s'
      if (duration === null || duration === undefined) {
        return {
          ok: false,
          status: 502,
          json: async () => ({ error: 'upstream said no' }),
        } as Response
      }
      return {
        ok: true,
        text: async () => JSON.stringify({ routes: [{ duration }] }),
      } as Response
    }
    throw new Error(`Unexpected fetch url: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function routeCallsFor(fetchMock: ReturnType<typeof stubFetch>, destination: string) {
  return fetchMock.mock.calls.filter(([input, init]) => {
    if (String(input) !== '/api/fetch') return false
    const sent = JSON.parse(((init as RequestInit)?.body as string) ?? '{}')
    return sent.body?.destination?.address === destination
  })
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

describe('drivingTimeIntegration.schema buffer_minutes', () => {
  it('defaults an absent key to 5, and does not zero a blank one', () => {
    expect(drivingTimeIntegration.schema.parse({ home_address: 'x' }).buffer_minutes).toBe(5)
    expect(
      drivingTimeIntegration.schema.parse({ home_address: 'x', buffer_minutes: '' }).buffer_minutes,
    ).toBe(5)
    expect(
      drivingTimeIntegration.schema.parse({ home_address: 'x', buffer_minutes: '10' })
        .buffer_minutes,
    ).toBe(10)
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

  it('does not fire when the google-cloud config has resolved but api_key is unset', async () => {
    // `driving-time.*` is fully configured; `google-cloud.api_key` is
    // absent. `googleCloudProvider`'s schema is all-optional, so this still
    // parses to a non-null config object once `/api/config` resolves — the
    // guard must check the key's value, not merely that the object exists.
    const fetchMock = stubFetch({
      configData: {
        'driving-time.home_address': '1 Infinite Loop, Cupertino, CA',
        'driving-time.buffer_minutes': '5',
      },
    })
    const events = [makeEvent('evt-1', 60, '1 Apple Park Way, Cupertino, CA')]

    renderHook(() => useDrivingTime(events), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/config')).toBe(true)
    })

    // Give the now-resolved (but key-less) config a chance to reach the
    // fetch effect before asserting it never fired.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/fetch')).toBe(false)
  })

  it('populates driveInfo with duration text and a leave-by time honoring buffer_minutes', async () => {
    stubFetch({}) // FULL_CONFIG: buffer_minutes '5'; /api/fetch resolves "650s"

    // `leaveByTime` is computed as `eventStart - durationMs - bufferMs` with
    // no dependency on when the hook happens to run, so a fixed, absolute
    // event start makes the expected value exact rather than a tolerance —
    // no fake-timer machinery needed.
    const event = makeEvent('evt-1', 60, '1 Apple Park Way, Cupertino, CA')
    const eventStart = new Date(event.start.dateTime!)

    const { result } = renderHook(() => useDrivingTime([event]), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current['evt-1']).toBeDefined())

    const info = result.current['evt-1']
    // 650s -> Math.floor((650 + 59) / 60) = 11 min.
    expect(info.durationSeconds).toBe(650)
    expect(info.durationText).toBe('11 min')

    // leaveByTime = event start - drive duration - buffer_minutes (5).
    const expectedLeaveBy = new Date(eventStart.getTime() - 650 * 1000 - 5 * 60 * 1000)
    expect(info.leaveByTime.getTime()).toBe(expectedLeaveBy.getTime())
  })

  it('keys each event by its own id when a destination in the middle fails', async () => {
    // The fan-out returns results in *input* order, so a map built from the
    // results alone would slide every later entry up by one when one
    // destination has no result — attaching B's drive time to C's event, and
    // rendering perfectly plausibly while doing it.
    stubFetch({ durationsByDestination: { 'A St': '600s', 'B St': null, 'C St': '1800s' } })
    const events = [
      makeEvent('evt-a', 60, 'A St'),
      makeEvent('evt-b', 90, 'B St'),
      makeEvent('evt-c', 120, 'C St'),
    ]

    const { result } = renderHook(() => useDrivingTime(events), { wrapper: createWrapper() })

    await waitFor(() => {
      expect(result.current['evt-a']).toBeDefined()
      expect(result.current['evt-c']).toBeDefined()
    })

    expect(result.current['evt-a'].durationSeconds).toBe(600)
    expect(result.current['evt-c'].durationSeconds).toBe(1800)
    // The failed destination gets no entry at all — not the next one's time.
    expect(result.current['evt-b']).toBeUndefined()
  })

  it('serves two consumers of the same destination from one proxied request', async () => {
    // The point of being on react-query: the grid draws the calendar widget
    // and the hero strip from the same events, and both call this hook. Off
    // the cache that was two identical Routes calls (and two billed
    // requests); keyed through `integrationQueryKey` it is one.
    const fetchMock = stubFetch({ durationsByDestination: { 'A St': '600s' } })
    const events = [makeEvent('evt-a', 60, 'A St')]
    const wrapper = createWrapper()

    const first = renderHook(() => useDrivingTime(events), { wrapper })
    const second = renderHook(() => useDrivingTime(events), { wrapper })

    await waitFor(() => {
      expect(first.result.current['evt-a']).toBeDefined()
      expect(second.result.current['evt-a']).toBeDefined()
    })

    expect(routeCallsFor(fetchMock, 'A St')).toHaveLength(1)
  })
})
