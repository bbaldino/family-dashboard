import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCalendarEvents } from './useCalendarEvents'
import { useGoogleCalendar } from './useGoogleCalendar'
import type { CalendarEvent } from '@/providers/google-calendar'

/**
 * `AssignmentsTab`'s flat week of events. It no longer fetches: a week near
 * today is inside the provider's synced window, so it filters from it.
 *
 * Two properties beyond the flatten are worth pinning. The **request saving**
 * — the row and the week strip together must not add a single `/events` call
 * — is the whole reason this changed, and it is invisible on screen. And the
 * **weeks the tab can page to that the window does not cover**: `prevWeek`
 * has no clamp, so five clicks back leaves the window, and a week that
 * straddles its edge is the dangerous one because it renders plausibly with
 * a couple of columns quietly empty.
 *
 * Timezone is pinned to America/Los_Angeles in vite.config.ts's test.env.
 */

const NOW = new Date('2026-05-11T09:00:00')
/** The window the provider syncs: Apr 1 through Nov 1, month-aligned. */
const WINDOW_START = new Date(2026, 3, 1)
const WINDOW_END = new Date(2026, 10, 1)

/** The week the tab opens on — inside the window. */
const START = new Date(2026, 4, 11)
const END = new Date(2026, 4, 18)

/** Five clicks of `<`: Mon Mar 30 – Sun Apr 5, straddling the window start. */
const STRADDLE_START = new Date(2026, 2, 30)
const STRADDLE_END = new Date(2026, 3, 6)

function event(id: string, date = '2026-05-12'): CalendarEvent {
  return { id, summary: id, start: { date }, end: { date } }
}

interface ServerOptions {
  /** Value stored at `calendar.calendar_ids`, if any. */
  calendarIds?: string
  /** Events per calendar id; a missing id responds 500. */
  eventsByCalendar: Record<string, CalendarEvent[]>
}

function stubFetch(options: ServerOptions) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/config') {
      const config =
        options.calendarIds === undefined ? {} : { 'calendar.calendar_ids': options.calendarIds }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(config) } as Response)
    }
    if (url.startsWith('/api/google-calendar/events')) {
      const params = new URL(url, 'http://localhost').searchParams
      const calendar = params.get('calendar') ?? ''
      const events = options.eventsByCalendar[calendar]
      if (!events) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'calendar unavailable' }),
        } as Response)
      }
      const from = new Date(params.get('start') ?? '').getTime()
      const to = new Date(params.get('end') ?? '').getTime()
      // The upstream returns what overlaps the asked range, so a fetch for a
      // month outside the window cannot accidentally answer with everything.
      const inRange = events.filter((e) => {
        const at = new Date(`${e.start.date}T00:00:00`).getTime()
        return at >= from && at < to
      })
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(inRange)),
      } as Response)
    }
    return Promise.reject(new Error(`Unexpected fetch url: ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function eventUrls(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => url.startsWith('/api/google-calendar/events'))
}

function windowUrl(calendar: string): string {
  return `/api/google-calendar/events?calendar=${encodeURIComponent(calendar)}&start=${encodeURIComponent(WINDOW_START.toISOString())}&end=${encodeURIComponent(WINDOW_END.toISOString())}`
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useCalendarEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('flattens the week out of the synced window without a request of its own', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['family@group.calendar.google.com', 'work']),
      eventsByCalendar: {
        'family@group.calendar.google.com': [event('dentist')],
        work: [event('standup')],
      },
    })

    const { result } = renderHook(() => useCalendarEvents(START, END), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data!.map((e) => e.id).sort()).toEqual(['dentist', 'standup'])
    expect(eventUrls(fetchMock)).toEqual([
      windowUrl('family@group.calendar.google.com'),
      windowUrl('work'),
    ])
  })

  it('adds no requests when the week strip is already mounted', async () => {
    // The saving, stated as a whole: the dashboard's two in-window calendar
    // consumers side by side cost exactly one sync per calendar between them,
    // where they used to cost a fan-out each.
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['home', 'work']),
      eventsByCalendar: { home: [event('soccer')], work: [event('standup')] },
    })

    const { result } = renderHook(
      () => ({ week: useGoogleCalendar(), row: useCalendarEvents(START, END) }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.week.data).not.toBeNull())
    await waitFor(() => expect(result.current.row.data).toBeDefined())

    expect(eventUrls(fetchMock)).toEqual([windowUrl('home'), windowUrl('work')])
  })

  it('returns the days outside the window for a week that straddles its edge', async () => {
    // `prevWeek` has no clamp, so this week is five clicks away. Filtering it
    // out of the window alone would drop Monday and Tuesday and look fine.
    stubFetch({
      calendarIds: JSON.stringify(['home']),
      eventsByCalendar: {
        home: [event('outsideMonday', '2026-03-30'), event('insideThursday', '2026-04-02')],
      },
    })

    const { result } = renderHook(() => useCalendarEvents(STRADDLE_START, STRADDLE_END), {
      wrapper: createWrapper(),
    })

    await waitFor(() =>
      expect(result.current.data?.map((e) => e.id).sort()).toEqual([
        'insideThursday',
        'outsideMonday',
      ]),
    )
  })

  it('falls back to the primary calendar when none is configured', async () => {
    const fetchMock = stubFetch({ eventsByCalendar: { primary: [event('lunch')] } })

    const { result } = renderHook(() => useCalendarEvents(START, END), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data!.map((e) => e.id)).toEqual(['lunch'])
    expect(eventUrls(fetchMock)).toEqual([windowUrl('primary')])
  })

  it('keeps the surviving calendars when one of them fails', async () => {
    // The row this feeds is a week of chores; one broken calendar blanking the
    // whole row is exactly what the per-calendar split is there to prevent.
    stubFetch({
      calendarIds: JSON.stringify(['broken', 'work']),
      eventsByCalendar: { work: [event('standup')] },
    })

    const { result } = renderHook(() => useCalendarEvents(START, END), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data!.map((e) => e.id)).toEqual(['standup'])
    expect(result.current.isError).toBe(false)
  })

  it('waits for the config before asking, so it never requests the wrong calendar first', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: { work: [event('standup')] },
    })

    const { result } = renderHook(() => useCalendarEvents(START, END), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data).toBeDefined())
    // Not a wasted round-trip against `primary` followed by a corrective one:
    // the ids are known before the first request goes out.
    expect(eventUrls(fetchMock)).toEqual([windowUrl('work')])
  })
})
