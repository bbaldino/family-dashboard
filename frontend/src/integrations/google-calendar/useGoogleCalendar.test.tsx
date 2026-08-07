import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGoogleCalendar } from './useGoogleCalendar'
import { CONFIG_QUERY_KEY } from '@/platform/useAllConfig'
import type { CalendarEvent } from './types'

/**
 * The week strip's hook. Three properties are pinned here beyond the
 * bucketing:
 *
 * 1. **Config reactivity.** The calendar ids are not baked in at mount —
 *    editing `google-calendar.calendar_ids` in admin re-asks the new
 *    calendars with no remount. This used to fall out of `fetchCalendarIds`
 *    being called *inside* the poll's fetcher; it now falls out of the ids
 *    being part of the query key. The tablet is a wall-mounted kiosk that
 *    never reloads, so "picked up on the next reload" means "never".
 * 2. **The `null`-before-success contract.** `UsePollingResult.data` is
 *    `null`, not react-query's `undefined`, until a fetch has actually
 *    succeeded — see `useLunchMenu` for the fuller account.
 * 3. **`isLoading` covers the config wait too.** `ScheduleColumn` picks
 *    between "Fetching the week ahead…" and "Nothing on the books this
 *    week." on that flag alone, so it must not read `false` while the
 *    config is still in flight.
 *
 * Timezone is pinned to America/Los_Angeles in vite.config.ts's test.env.
 */

const NOW = new Date('2026-05-11T09:00:00')
/** Local midnight of NOW — the start of the week window the hook asks for. */
const WINDOW_START = new Date(2026, 4, 11)
const WINDOW_END = new Date(2026, 4, 18)

function event(id: string, date: string): CalendarEvent {
  return { id, summary: id, start: { date }, end: { date } }
}

interface ServerOptions {
  /** Value stored at `google-calendar.calendar_ids`, if any. */
  calendarIds?: string
  /** Events per calendar id; a missing id responds 500. */
  eventsByCalendar: Record<string, CalendarEvent[]>
}

function stubFetch(options: ServerOptions) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/config') {
      const config =
        options.calendarIds === undefined
          ? {}
          : { 'google-calendar.calendar_ids': options.calendarIds }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(config) } as Response)
    }
    if (url.startsWith('/api/google-calendar/events')) {
      const calendar = new URL(url, 'http://localhost').searchParams.get('calendar') ?? ''
      const events = options.eventsByCalendar[calendar]
      if (!events) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'calendar unavailable' }),
        } as Response)
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(events)),
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

function calendarsAsked(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return eventUrls(fetchMock).map(
    (url) => new URL(url, 'http://localhost').searchParams.get('calendar') ?? '',
  )
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useGoogleCalendar', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('asks every configured calendar for today through the next seven days', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['family@group.calendar.google.com', 'work']),
      eventsByCalendar: {
        'family@group.calendar.google.com': [event('dentist', '2026-05-12')],
        work: [event('standup', '2026-05-13')],
      },
    })

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).not.toBeNull())

    expect(eventUrls(fetchMock)).toEqual([
      `/api/google-calendar/events?calendar=${encodeURIComponent('family@group.calendar.google.com')}&start=${encodeURIComponent(WINDOW_START.toISOString())}&end=${encodeURIComponent(WINDOW_END.toISOString())}`,
      `/api/google-calendar/events?calendar=work&start=${encodeURIComponent(WINDOW_START.toISOString())}&end=${encodeURIComponent(WINDOW_END.toISOString())}`,
    ])

    const days = result.current.data!
    expect(days).toHaveLength(7)
    expect(days[0].isToday).toBe(true)
    expect(days[1].events.map((e) => e.id)).toEqual(['dentist'])
    expect(days[2].events.map((e) => e.id)).toEqual(['standup'])
  })

  it('falls back to the primary calendar when none is configured', async () => {
    const fetchMock = stubFetch({ eventsByCalendar: { primary: [] } })

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(calendarsAsked(fetchMock)).toEqual(['primary'])
  })

  it('waits for the config before asking, so it never requests the wrong calendar first', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: { work: [] },
    })

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: wrapperFor(newClient()) })

    // Config reads as `null` both while it loads and when it is absent, so
    // without the gate this would fire once against `primary` and again
    // against `work` — the week strip filling, blanking, and filling again.
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(calendarsAsked(fetchMock)).toEqual(['work'])
  })

  it('returns null (not undefined) until the first fetch succeeds', async () => {
    stubFetch({ calendarIds: JSON.stringify(['work']), eventsByCalendar: { work: [] } })

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: wrapperFor(newClient()) })

    // Cold cache: `null`, not `undefined` — the `UsePollingResult` contract.
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(result.current.isLoading).toBe(false)
  })

  it('picks up a calendar_ids change without a remount', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: {
        work: [event('standup', '2026-05-12')],
        home: [event('soccer', '2026-05-12')],
      },
    })
    const queryClient = newClient()

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: wrapperFor(queryClient) })

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(calendarsAsked(fetchMock)).toEqual(['work'])

    // Someone swaps the selected calendars in admin. On the kiosk the config
    // poll (or, later, a save invalidating the config key) lands this in the
    // shared cache; either way no component remounts.
    act(() => {
      queryClient.setQueryData(CONFIG_QUERY_KEY, {
        'google-calendar.calendar_ids': JSON.stringify(['home']),
      })
    })

    await waitFor(() => expect(calendarsAsked(fetchMock)).toEqual(['work', 'home']))
    await waitFor(() =>
      expect(result.current.data!.flatMap((d) => d.events.map((e) => e.id))).toEqual(['soccer']),
    )
  })

  it('re-polls every five minutes', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: { work: [] },
    })

    renderHook(() => useGoogleCalendar(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(eventUrls(fetchMock)).toHaveLength(1))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    })

    await waitFor(() => expect(eventUrls(fetchMock)).toHaveLength(2))
  })
})
