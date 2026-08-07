import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useCountdowns } from './useCountdowns'
import { CONFIG_QUERY_KEY } from '@/platform'

/**
 * `useCountdowns` fetches through `googleCalendarIntegration.api` (a plain
 * `fetch` against this app's own `/api/google-calendar/events` route, not
 * the external-upstream `/api/fetch` proxy `useIntegrationData` uses), so
 * the stub below matches that route directly rather than `/api/fetch`.
 *
 * This suite pins the composed request (calendar id + ISO start/end derived
 * from `horizon_days`), the hourly poll cadence, and — the point of Task 1
 * per the migration plan — that `data` stays `null` (not `undefined`) until
 * the first fetch actually succeeds, exactly as the `PollResult`
 * contract guarantees. `HouseholdColumn` and the grid widget-meta both read
 * `data ?? []`, which happens to tolerate either, but the contract is
 * `PollResult<T>` and this hook still owes it.
 */

const NOW = new Date('2026-08-05T12:00:00')
const HORIZON_DAYS = 30
const CALENDAR_ID = 'family-calendar@group.calendar.google.com'

const CONFIG = {
  'countdowns.calendar_id': CALENDAR_ID,
  'countdowns.horizon_days': String(HORIZON_DAYS),
}

const EVENTS_PAYLOAD = [
  {
    id: 'evt-1',
    summary: "Kid's Birthday",
    start: { date: '2026-08-10' },
    end: { date: '2026-08-11' },
  },
  {
    id: 'evt-2',
    summary: 'Already passed',
    start: { date: '2026-08-01' },
    end: { date: '2026-08-02' },
  },
]

function stubFetch() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/config') {
      return { ok: true, json: async () => CONFIG } as Response
    }
    if (url.startsWith('/api/google-calendar/events')) {
      return { ok: true, text: async () => JSON.stringify(EVENTS_PAYLOAD) } as Response
    }
    throw new Error(`Unexpected fetch url: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function createWrapper(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function eventUrls(fetchMock: ReturnType<typeof stubFetch>): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.startsWith('/api/google-calendar/events'))
    .map((url) => new URL(url, 'http://localhost'))
}

describe('useCountdowns', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('composes the events request from the configured calendar id and horizon_days', async () => {
    const fetchMock = stubFetch()
    const { result } = renderHook(() => useCountdowns(), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data).not.toBeNull())

    const call = fetchMock.mock.calls.find(([input]) =>
      String(input).startsWith('/api/google-calendar/events'),
    )
    expect(call).toBeDefined()

    const url = new URL(String(call![0]), 'http://localhost')
    expect(url.searchParams.get('calendar')).toBe(CALENDAR_ID)

    // Real time trickles forward under `shouldAdvanceTime`, so pin the
    // *shape* (start ~= now, end - start == horizon_days) rather than an
    // exact millisecond-stamped ISO string.
    const start = new Date(url.searchParams.get('start')!)
    const end = new Date(url.searchParams.get('end')!)
    expect(Math.abs(start.getTime() - NOW.getTime())).toBeLessThan(1000)
    expect(end.getTime() - start.getTime()).toBe(HORIZON_DAYS * 24 * 60 * 60 * 1000)
  })

  it('returns null (not undefined) until the first fetch succeeds, then the future-dated, sorted items', async () => {
    stubFetch()
    const { result } = renderHook(() => useCountdowns(), { wrapper: createWrapper() })

    // Cold cache: null, not undefined — the `PollResult` contract.
    expect(result.current.data).toBeNull()

    await waitFor(() => expect(result.current.data).not.toBeNull())

    expect(result.current.data).toEqual([
      expect.objectContaining({ id: 'evt-1', name: "Kid's Birthday", daysUntil: 5 }),
    ])
  })

  it('re-asks with a new window when horizon_days changes, without a remount', async () => {
    const fetchMock = stubFetch()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => useCountdowns(), { wrapper: createWrapper(queryClient) })

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(eventUrls(fetchMock)).toHaveLength(1)

    // Someone widens "Days ahead" in admin. `horizon_days` is an argument to
    // the fetch, so it has to be part of the query key — otherwise this
    // lands in the shared cache and the hook goes on serving the old
    // 30-day window until the hourly poll comes round.
    act(() => {
      queryClient.setQueryData(CONFIG_QUERY_KEY, {
        ...CONFIG,
        'countdowns.horizon_days': '60',
      })
    })

    await waitFor(() => expect(eventUrls(fetchMock)).toHaveLength(2))
    const [start, end] = ['start', 'end'].map(
      (p) => new Date(eventUrls(fetchMock)[1].searchParams.get(p)!),
    )
    expect(end.getTime() - start.getTime()).toBe(60 * 24 * 60 * 60 * 1000)
  })

  it('polls hourly', async () => {
    const fetchMock = stubFetch()
    renderHook(() => useCountdowns(), { wrapper: createWrapper() })

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).startsWith('/api/google-calendar/events'),
        ).length,
      ).toBe(1),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    })

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) =>
          String(input).startsWith('/api/google-calendar/events'),
        ).length,
      ).toBe(2),
    )
  })
})
