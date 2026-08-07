import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMonthCalendar } from './useMonthCalendar'
import { CONFIG_QUERY_KEY } from '@/platform/useAllConfig'
import type { CalendarEvent } from '@/providers/google-calendar'

// Timezone is pinned to America/Los_Angeles in vite.config.ts's test.env, so
// the -07:00 offsets below bucket unambiguously (see eventLocalDateStr).

/**
 * Beyond the bucketing rules, this pins the same two properties as
 * `useGoogleCalendar.test.tsx`: the month grid asks the *configured*
 * calendars (falling back to `primary`), and a `calendar_ids` change is
 * picked up with no remount — the kiosk never reloads, so an id list baked
 * in at mount would be baked in forever.
 */

interface ServerOptions {
  /** Value stored at `calendar.calendar_ids`, if any. */
  calendarIds?: string
  /** Events per calendar id; a missing id responds 500. */
  eventsByCalendar: Record<string, CalendarEvent[]>
  /** Calendar ids whose response is withheld until the promise resolves, so
   *  a test can inspect the hook while that fetch is still in flight. */
  hold?: Record<string, Promise<void>>
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
      const response = {
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(events)),
      } as Response
      const gate = options.hold?.[calendar]
      return gate ? gate.then(() => response) : Promise.resolve(response)
    }
    return Promise.reject(new Error(`Unexpected fetch url: ${url}`))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** Just the events requests, as the calendar id each one asked for. */
function calendarsAsked(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return fetchMock.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => url.startsWith('/api/google-calendar/events'))
    .map((url) => new URL(url, 'http://localhost').searchParams.get('calendar') ?? '')
}

/** Events requests as `[start, end]` ISO pairs. */
function windowsAsked(fetchMock: ReturnType<typeof stubFetch>): [string, string][] {
  return fetchMock.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => url.startsWith('/api/google-calendar/events'))
    .map((url) => {
      const params = new URL(url, 'http://localhost').searchParams
      return [params.get('start') ?? '', params.get('end') ?? ''] as [string, string]
    })
}

/** A single-calendar server whose one calendar returns `events`. */
function mockFetch(events: CalendarEvent[]) {
  return stubFetch({ eventsByCalendar: { primary: events } })
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

async function renderMonthCalendar(year: number, month: number) {
  const { result } = renderHook(() => useMonthCalendar(year, month), {
    wrapper: wrapperFor(newClient()),
  })
  await waitFor(() => expect(result.current.data).not.toBeNull())
  return result.current.data!
}

describe('useMonthCalendar', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('expands a multi-day all-day event across every day it spans, using an exclusive end date', async () => {
    // Google Calendar's all-day end date is exclusive: start 05-10 / end 05-13
    // spans the 10th, 11th and 12th but not the 13th.
    const trip: CalendarEvent = {
      id: 'trip',
      summary: 'Family trip',
      start: { date: '2026-05-10' },
      end: { date: '2026-05-13' },
    }
    mockFetch([trip])

    const { byDate } = await renderMonthCalendar(2026, 4)

    expect(byDate['2026-05-10']?.map((e) => e.id)).toEqual(['trip'])
    expect(byDate['2026-05-11']?.map((e) => e.id)).toEqual(['trip'])
    expect(byDate['2026-05-12']?.map((e) => e.id)).toEqual(['trip'])
    expect(byDate['2026-05-13']).toBeUndefined()
  })

  it('buckets a single-day timed event under its own local date only', async () => {
    const lunch: CalendarEvent = {
      id: 'lunch',
      summary: 'Lunch',
      start: { dateTime: '2026-05-15T12:00:00-07:00' },
      end: { dateTime: '2026-05-15T13:00:00-07:00' },
    }
    mockFetch([lunch])

    const { byDate } = await renderMonthCalendar(2026, 4)

    expect(byDate['2026-05-15']?.map((e) => e.id)).toEqual(['lunch'])
    expect(Object.keys(byDate)).toEqual(['2026-05-15'])
  })

  it('sorts each day with all-day events first, then timed events chronologically', async () => {
    const earlyMeeting: CalendarEvent = {
      id: 'early-meeting',
      summary: 'Early meeting',
      start: { dateTime: '2026-05-15T09:00:00-07:00' },
      end: { dateTime: '2026-05-15T09:30:00-07:00' },
    }
    const lateMeeting: CalendarEvent = {
      id: 'late-meeting',
      summary: 'Late meeting',
      start: { dateTime: '2026-05-15T14:00:00-07:00' },
      end: { dateTime: '2026-05-15T14:30:00-07:00' },
    }
    const holiday: CalendarEvent = {
      id: 'holiday',
      summary: 'Holiday',
      start: { date: '2026-05-15' },
      end: { date: '2026-05-16' },
    }
    // Deliberately out of order in the source data.
    mockFetch([lateMeeting, earlyMeeting, holiday])

    const { byDate } = await renderMonthCalendar(2026, 4)

    expect(byDate['2026-05-15']?.map((e) => e.id)).toEqual([
      'holiday',
      'early-meeting',
      'late-meeting',
    ])
  })

  it('asks every configured calendar for the whole displayed grid, not just the month', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['family@group.calendar.google.com', 'work']),
      eventsByCalendar: { 'family@group.calendar.google.com': [], work: [] },
    })

    const { result } = renderHook(() => useMonthCalendar(2026, 4), {
      wrapper: wrapperFor(newClient()),
    })
    await waitFor(() => expect(result.current.data).not.toBeNull())

    expect(calendarsAsked(fetchMock)).toEqual(['family@group.calendar.google.com', 'work'])
    // May 2026 starts on a Friday and ends on a Sunday, so the grid runs from
    // Sunday April 26th to (exclusive) Sunday June 7th.
    const gridStart = new Date(2026, 3, 26).toISOString()
    const gridEnd = new Date(2026, 5, 7).toISOString()
    expect(windowsAsked(fetchMock)).toEqual([
      [gridStart, gridEnd],
      [gridStart, gridEnd],
    ])
  })

  it('falls back to the primary calendar when none is configured', async () => {
    const fetchMock = stubFetch({ eventsByCalendar: { primary: [] } })

    const { result } = renderHook(() => useMonthCalendar(2026, 4), {
      wrapper: wrapperFor(newClient()),
    })
    await waitFor(() => expect(result.current.data).not.toBeNull())

    expect(calendarsAsked(fetchMock)).toEqual(['primary'])
  })

  it('waits for the config before asking, so it never requests the wrong calendar first', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: { work: [] },
    })

    const { result } = renderHook(() => useMonthCalendar(2026, 4), {
      wrapper: wrapperFor(newClient()),
    })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(calendarsAsked(fetchMock)).toEqual(['work'])
  })

  it('returns null (not undefined) until the first fetch succeeds', async () => {
    stubFetch({ calendarIds: JSON.stringify(['work']), eventsByCalendar: { work: [] } })

    const { result } = renderHook(() => useMonthCalendar(2026, 4), {
      wrapper: wrapperFor(newClient()),
    })

    // Cold cache: `null`, not `undefined` — the `PollResult` contract
    // `Calendar.tsx` documents relying on.
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()

    await waitFor(() => expect(result.current.data).not.toBeNull())
  })

  it('picks up a calendar_ids change without a remount', async () => {
    const soccer: CalendarEvent = {
      id: 'soccer',
      summary: 'Soccer',
      start: { date: '2026-05-15' },
      end: { date: '2026-05-16' },
    }
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: { work: [], home: [soccer] },
    })
    const queryClient = newClient()

    const { result } = renderHook(() => useMonthCalendar(2026, 4), {
      wrapper: wrapperFor(queryClient),
    })

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(calendarsAsked(fetchMock)).toEqual(['work'])

    act(() => {
      queryClient.setQueryData(CONFIG_QUERY_KEY, {
        'calendar.calendar_ids': JSON.stringify(['home']),
      })
    })

    await waitFor(() => expect(calendarsAsked(fetchMock)).toEqual(['work', 'home']))
    await waitFor(() => expect(result.current.data!.byDate['2026-05-15']).toBeDefined())
  })

  // See `useGoogleCalendar.test.tsx`: `placeholderData: keepPreviousData` is
  // the only thing stopping the ids' move into the query key from emptying
  // the month grid for the length of a round trip every time the selected
  // calendars change.
  it('keeps the previous month on screen while the new calendars are still fetching', async () => {
    const standup: CalendarEvent = {
      id: 'standup',
      summary: 'Standup',
      start: { date: '2026-05-14' },
      end: { date: '2026-05-15' },
    }
    const soccer: CalendarEvent = {
      id: 'soccer',
      summary: 'Soccer',
      start: { date: '2026-05-15' },
      end: { date: '2026-05-16' },
    }
    let landHome = () => {}
    const homeInFlight = new Promise<void>((resolve) => {
      landHome = resolve
    })
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: { work: [standup], home: [soccer] },
      hold: { home: homeInFlight },
    })
    const queryClient = newClient()

    const { result } = renderHook(() => useMonthCalendar(2026, 4), {
      wrapper: wrapperFor(queryClient),
    })

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(result.current.data!.byDate['2026-05-14']?.map((e) => e.id)).toEqual(['standup'])

    act(() => {
      queryClient.setQueryData(CONFIG_QUERY_KEY, {
        'calendar.calendar_ids': JSON.stringify(['home']),
      })
    })

    // The new key's fetch is out but deliberately unresolved. The grid keeps
    // last month's buckets rather than emptying.
    await waitFor(() => expect(calendarsAsked(fetchMock)).toEqual(['work', 'home']))
    expect(result.current.data).not.toBeNull()
    expect(result.current.data!.byDate['2026-05-14']?.map((e) => e.id)).toEqual(['standup'])

    landHome()
    await waitFor(() => expect(result.current.data!.byDate['2026-05-15']).toBeDefined())
    expect(result.current.data!.byDate['2026-05-14']).toBeUndefined()
  })

  it('re-polls every five minutes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const fetchMock = stubFetch({
        calendarIds: JSON.stringify(['work']),
        eventsByCalendar: { work: [] },
      })

      renderHook(() => useMonthCalendar(2026, 4), { wrapper: wrapperFor(newClient()) })

      await waitFor(() => expect(calendarsAsked(fetchMock)).toHaveLength(1))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
      })

      await waitFor(() => expect(calendarsAsked(fetchMock)).toHaveLength(2))
    } finally {
      vi.useRealTimers()
    }
  })
})
