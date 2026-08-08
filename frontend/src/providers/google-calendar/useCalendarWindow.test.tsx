import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAllConfig, CONFIG_QUERY_KEY } from '@/platform'
import { useCalendarWindow } from './useCalendarWindow'
import type { CalendarEvent } from './types'

/**
 * The one sync every in-window consumer is meant to read from, so what is
 * pinned here is the request count and the *shape of the answer* rather than
 * any rendering: nothing consumes this yet.
 *
 * The sharp one is the last group. A calendar that fails to load still
 * resolves `events` to `[]`, which is indistinguishable from a quiet one
 * unless something keeps the failure separately — on 2026-08-07 telling
 * those apart took a manual 12-month probe against the backend. This hook
 * keeps one query per calendar precisely so `error` can hold that
 * distinction, and the "empty and broken are not the same" test is what
 * holds it there.
 *
 * The hook is handed the *stored* calendar-ids string rather than reading it
 * itself: which config key holds them is the consumer's business (countdowns
 * uses a different one), and a provider may not import an integration. These
 * tests wire it the way a consumer will, through `useAllConfig`.
 *
 * Timezone is pinned to America/Los_Angeles in vite.config.ts's test.env.
 */

const NOW = new Date('2026-05-11T09:00:00')
/** One month back, five months forward, month-aligned: Apr 1 through Nov 1. */
const WINDOW_START = new Date(2026, 3, 1)
const WINDOW_END = new Date(2026, 10, 1)

function event(id: string, date: string): CalendarEvent {
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

/** How a consumer will call it: its own config key, the provider's window. */
function useWindowFromConfig() {
  const { data } = useAllConfig()
  return useCalendarWindow(data?.['calendar.calendar_ids'])
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useCalendarWindow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('asks each configured calendar once, for one month back through five months forward', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['family@group.calendar.google.com', 'work']),
      eventsByCalendar: { 'family@group.calendar.google.com': [], work: [] },
    })

    const { result } = renderHook(() => useWindowFromConfig(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(eventUrls(fetchMock)).toEqual([
      `/api/google-calendar/events?calendar=${encodeURIComponent('family@group.calendar.google.com')}&start=${encodeURIComponent(WINDOW_START.toISOString())}&end=${encodeURIComponent(WINDOW_END.toISOString())}`,
      `/api/google-calendar/events?calendar=work&start=${encodeURIComponent(WINDOW_START.toISOString())}&end=${encodeURIComponent(WINDOW_END.toISOString())}`,
    ])
    expect(result.current.start).toEqual(WINDOW_START)
    expect(result.current.end).toEqual(WINDOW_END)
  })

  it('merges the events from every calendar', async () => {
    stubFetch({
      calendarIds: JSON.stringify(['home', 'work']),
      eventsByCalendar: {
        home: [event('soccer', '2026-05-12')],
        work: [event('standup', '2026-06-01'), event('offsite', '2026-09-30')],
      },
    })

    const { result } = renderHook(() => useWindowFromConfig(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.events).toHaveLength(3))
    expect(result.current.events.map((e) => e.id).sort()).toEqual(['offsite', 'soccer', 'standup'])
  })

  it('falls back to the primary calendar when none is configured', async () => {
    const fetchMock = stubFetch({ eventsByCalendar: { primary: [] } })

    const { result } = renderHook(() => useWindowFromConfig(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(calendarsAsked(fetchMock)).toEqual(['primary'])
  })

  it('waits for the config before asking, so it never syncs the wrong calendar first', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: { work: [] },
    })

    const { result } = renderHook(() => useWindowFromConfig(), { wrapper: wrapperFor(newClient()) })

    // Config reads as absent both while it loads and when it is genuinely
    // unset, so without the gate this would sync `primary` and then correct
    // itself — a wasted round trip per calendar on every boot.
    expect(result.current.isLoading).toBe(true)
    expect(eventUrls(fetchMock)).toHaveLength(0)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(calendarsAsked(fetchMock)).toEqual(['work'])
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

    const { result } = renderHook(() => useWindowFromConfig(), { wrapper: wrapperFor(queryClient) })

    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['standup']))

    act(() => {
      queryClient.setQueryData(CONFIG_QUERY_KEY, {
        'calendar.calendar_ids': JSON.stringify(['home']),
      })
    })

    await waitFor(() => expect(calendarsAsked(fetchMock)).toEqual(['work', 'home']))
    await waitFor(() => expect(result.current.events.map((e) => e.id)).toEqual(['soccer']))
  })

  it('keeps the surviving calendars events when one of them fails', async () => {
    stubFetch({
      calendarIds: JSON.stringify(['broken', 'work']),
      eventsByCalendar: { work: [event('standup', '2026-05-12')] },
    })

    const { result } = renderHook(() => useWindowFromConfig(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.events.map((e) => e.id)).toEqual(['standup'])
  })

  it('says which calendar failed, and does not confuse it with one that is simply empty', async () => {
    stubFetch({
      calendarIds: JSON.stringify(['broken', 'quiet', 'work']),
      eventsByCalendar: { quiet: [], work: [event('standup', '2026-05-12')] },
    })

    const { result } = renderHook(() => useWindowFromConfig(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const byId = Object.fromEntries(result.current.calendars.map((c) => [c.calendarId, c]))
    expect(Object.keys(byId).sort()).toEqual(['broken', 'quiet', 'work'])

    // Both hold no events. Only one of them is a problem, and the caller has
    // to be able to tell which — this is the whole diagnostic point of one
    // query per calendar.
    expect(byId.broken.events).toEqual([])
    expect(byId.quiet.events).toEqual([])
    expect(byId.broken.error).toBeInstanceOf(Error)
    expect(byId.broken.error?.message).toBe('calendar unavailable')
    expect(byId.quiet.error).toBeNull()
    expect(byId.work.error).toBeNull()
    expect(byId.work.events.map((e) => e.id)).toEqual(['standup'])
  })

  it('reports no window-level error while any calendar is still readable', async () => {
    stubFetch({
      calendarIds: JSON.stringify(['broken', 'work']),
      eventsByCalendar: { work: [] },
    })

    const { result } = renderHook(() => useWindowFromConfig(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeNull()
  })

  it('reports a window-level error once every calendar has failed', async () => {
    stubFetch({ calendarIds: JSON.stringify(['broken', 'alsoBroken']), eventsByCalendar: {} })

    const { result } = renderHook(() => useWindowFromConfig(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.error).not.toBeNull())
    expect(result.current.error?.message).toBe('calendar unavailable')
    expect(result.current.events).toEqual([])
  })

  it('re-syncs every five minutes', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: { work: [] },
    })

    renderHook(() => useWindowFromConfig(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(eventUrls(fetchMock)).toHaveLength(1))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
    })

    await waitFor(() => expect(eventUrls(fetchMock)).toHaveLength(2))
  })
})
