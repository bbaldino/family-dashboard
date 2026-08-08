import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMonthCalendar } from './useMonthCalendar'
import { CONFIG_QUERY_KEY } from '@/platform/useAllConfig'
import type { CalendarEvent } from '@/providers/google-calendar'

/**
 * The month grid, read through the provider's range resolver.
 *
 * Two properties matter beyond the bucketing rules. **A month inside the
 * synced window costs nothing** — the grid's range is already in memory and
 * asking upstream for it again was most of the 11–16 requests a dashboard
 * load used to make. **A month outside it still loads**, because this is the
 * one consumer that can ask for anything: both themes page months freely,
 * with year rollover.
 *
 * The bucketing itself is unchanged and deliberately so: a multi-day event is
 * walked across every date it covers so it appears on each, and each day is
 * sorted all-day first.
 *
 * Timezone is pinned to America/Los_Angeles in vite.config.ts's test.env, so
 * the -07:00 offsets below bucket unambiguously (see eventLocalDateStr).
 */

const NOW = new Date('2026-05-11T09:00:00')
/** One month back, five months forward, month-aligned: Apr 1 through Nov 1. */
const WINDOW_START = new Date(2026, 3, 1)
const WINDOW_END = new Date(2026, 10, 1)

/** May 2026 — inside the window, grid included: Apr 26 through Jun 6. */
const IN_YEAR = 2026
const IN_MONTH = 4

/** January 2026 — outside it, grid included: Dec 28 2025 through Jan 31. */
const OUT_YEAR = 2026
const OUT_MONTH = 0

interface ServerOptions {
  /** Value stored at `calendar.calendar_ids`, if any. */
  calendarIds?: string
  /** Events per calendar id; a missing id responds 500. */
  eventsByCalendar: Record<string, CalendarEvent[]>
  /** Calendar ids whose response is withheld until the promise resolves, so
   *  a test can inspect the hook while that fetch is still in flight. */
  hold?: Record<string, Promise<void>>
}

function eventBounds(event: CalendarEvent): { start: number; end: number } {
  const startStr = event.start.dateTime ?? event.start.date ?? ''
  const endStr = event.end.dateTime ?? event.end.date ?? startStr
  const start = new Date(event.start.dateTime ? startStr : `${startStr}T00:00:00`).getTime()
  const end = new Date(event.end.dateTime ? endStr : `${endStr}T00:00:00`).getTime()
  return { start, end: Math.max(end, start + 1) }
}

/**
 * Serves `/events` the way Google does: everything **overlapping** the asked
 * range, not everything starting in it. The grid depends on that — a trip
 * that began last month still has to appear on this month's leading days.
 */
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
      const overlapping = events.filter((e) => {
        const bounds = eventBounds(e)
        return bounds.start < to && bounds.end > from
      })
      const response = {
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(overlapping)),
      } as Response
      const gate = options.hold?.[calendar]
      return gate ? gate.then(() => response) : Promise.resolve(response)
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

/** Just the events requests, as the calendar id each one asked for. */
function calendarsAsked(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return eventUrls(fetchMock).map(
    (url) => new URL(url, 'http://localhost').searchParams.get('calendar') ?? '',
  )
}

/** Every `/events` request as a readable `calendar start→end` line. */
function requestsMade(fetchMock: ReturnType<typeof stubFetch>): string[] {
  return eventUrls(fetchMock).map((url) => {
    const params = new URL(url, 'http://localhost').searchParams
    return `${params.get('calendar')} ${params.get('start')}→${params.get('end')}`
  })
}

function windowRequest(calendar: string): string {
  return `${calendar} ${WINDOW_START.toISOString()}→${WINDOW_END.toISOString()}`
}

function monthRequest(calendar: string, year: number, month: number): string {
  return `${calendar} ${new Date(year, month, 1).toISOString()}→${new Date(year, month + 1, 1).toISOString()}`
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
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('where the events come from', () => {
    it('issues no request of its own for a month inside the synced window', async () => {
      const fetchMock = stubFetch({
        calendarIds: JSON.stringify(['home', 'work']),
        eventsByCalendar: {
          home: [
            {
              id: 'soccer',
              summary: 'Soccer',
              start: { date: '2026-05-12' },
              end: { date: '2026-05-13' },
            },
          ],
          work: [
            {
              id: 'standup',
              summary: 'Standup',
              start: { date: '2026-05-13' },
              end: { date: '2026-05-14' },
            },
          ],
        },
      })

      const { result } = renderHook(() => useMonthCalendar(IN_YEAR, IN_MONTH), {
        wrapper: wrapperFor(newClient()),
      })
      await waitFor(() => expect(result.current.data).not.toBeNull())

      expect(result.current.data!.byDate['2026-05-12']?.map((e) => e.id)).toEqual(['soccer'])
      expect(result.current.data!.byDate['2026-05-13']?.map((e) => e.id)).toEqual(['standup'])
      // The window sync's own requests and nothing else — the grid's range,
      // leading and trailing days included, is already in memory.
      expect(requestsMade(fetchMock)).toEqual([windowRequest('home'), windowRequest('work')])
    })

    it('fetches a month outside the window, and pages back to it for free', async () => {
      const fetchMock = stubFetch({
        calendarIds: JSON.stringify(['home']),
        eventsByCalendar: {
          home: [
            {
              id: 'recital',
              summary: 'Recital',
              start: { date: '2026-01-14' },
              end: { date: '2026-01-15' },
            },
          ],
        },
      })

      const { result, rerender } = renderHook(
        ({ year, month }: { year: number; month: number }) => useMonthCalendar(year, month),
        {
          wrapper: wrapperFor(newClient()),
          initialProps: { year: OUT_YEAR, month: OUT_MONTH },
        },
      )

      await waitFor(() => expect(result.current.data?.byDate['2026-01-14']).toBeDefined())
      // Whole months, both of the ones January's grid touches — an exact-range
      // fetch would miss by days and re-request on every page.
      expect(requestsMade(fetchMock)).toEqual([
        windowRequest('home'),
        monthRequest('home', 2025, 11),
        monthRequest('home', 2026, 0),
      ])
      const afterFirstVisit = requestsMade(fetchMock).length

      // Page into the window and back out to the same month.
      rerender({ year: IN_YEAR, month: IN_MONTH })
      await waitFor(() => expect(result.current.data!.byDate['2026-01-14']).toBeUndefined())
      rerender({ year: OUT_YEAR, month: OUT_MONTH })
      await waitFor(() => expect(result.current.data!.byDate['2026-01-14']).toBeDefined())

      expect(requestsMade(fetchMock)).toHaveLength(afterFirstVisit)
    })

    it('fills the grid days that belong to the adjacent months, not just the month itself', async () => {
      // January 2026 opens on a Thursday, so its grid starts Sunday Dec 28.
      stubFetch({
        calendarIds: JSON.stringify(['home']),
        eventsByCalendar: {
          home: [
            {
              id: 'newYearsEve',
              summary: 'NYE',
              start: { date: '2025-12-31' },
              end: { date: '2026-01-01' },
            },
          ],
        },
      })

      const { result } = renderHook(() => useMonthCalendar(OUT_YEAR, OUT_MONTH), {
        wrapper: wrapperFor(newClient()),
      })

      await waitFor(() => expect(result.current.data?.byDate['2025-12-31']).toBeDefined())
      expect(result.current.data!.byDate['2025-12-31'].map((e) => e.id)).toEqual(['newYearsEve'])
    })

    it('picks up the window poll, so a month on screen for hours does not go stale', async () => {
      const fetchMock = stubFetch({
        calendarIds: JSON.stringify(['work']),
        eventsByCalendar: { work: [] },
      })

      renderHook(() => useMonthCalendar(IN_YEAR, IN_MONTH), { wrapper: wrapperFor(newClient()) })

      await waitFor(() => expect(calendarsAsked(fetchMock)).toHaveLength(1))

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
      })

      await waitFor(() => expect(calendarsAsked(fetchMock)).toHaveLength(2))
    })
  })

  describe('bucketing', () => {
    it('expands a multi-day all-day event across every day it spans, using an exclusive end date', async () => {
      // Google Calendar's all-day end date is exclusive: start 05-10 / end
      // 05-13 spans the 10th, 11th and 12th but not the 13th.
      const trip: CalendarEvent = {
        id: 'trip',
        summary: 'Family trip',
        start: { date: '2026-05-10' },
        end: { date: '2026-05-13' },
      }
      mockFetch([trip])

      const { byDate } = await renderMonthCalendar(IN_YEAR, IN_MONTH)

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

      const { byDate } = await renderMonthCalendar(IN_YEAR, IN_MONTH)

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
      // A **timed** event that started the day before and is still running on
      // the 15th. This is what makes "all-day first" load-bearing rather than
      // a coincidence: its start string ('2026-05-14T18:00…') sorts before the
      // all-day's ('2026-05-15'), so comparing starts alone would put the
      // camping trip above the holiday. A day cell shows only a few pills, so
      // this ordering decides what gets cut.
      const camping: CalendarEvent = {
        id: 'camping',
        summary: 'Camping trip',
        start: { dateTime: '2026-05-14T18:00:00-07:00' },
        end: { dateTime: '2026-05-16T11:00:00-07:00' },
      }
      // Deliberately out of order in the source data.
      mockFetch([lateMeeting, camping, earlyMeeting, holiday])

      const { byDate } = await renderMonthCalendar(IN_YEAR, IN_MONTH)

      expect(byDate['2026-05-15']?.map((e) => e.id)).toEqual([
        'holiday',
        'camping',
        'early-meeting',
        'late-meeting',
      ])
    })

    it('lists an event spanning the window edge once, not once per source', async () => {
      // April is in the window and March is not, so a trip across the 1st
      // comes back from both the window and the expansion fetch.
      stubFetch({
        calendarIds: JSON.stringify(['home']),
        eventsByCalendar: {
          home: [
            {
              id: 'springBreak',
              summary: 'Spring break',
              start: { date: '2026-03-30' },
              end: { date: '2026-04-02' },
            },
          ],
        },
      })

      const { result } = renderHook(() => useMonthCalendar(2026, 2), {
        wrapper: wrapperFor(newClient()),
      })

      await waitFor(() => expect(result.current.data?.byDate['2026-04-01']).toBeDefined())
      expect(result.current.data!.byDate['2026-03-30'].map((e) => e.id)).toEqual(['springBreak'])
      expect(result.current.data!.byDate['2026-04-01'].map((e) => e.id)).toEqual(['springBreak'])
    })
  })

  describe('the configured calendars', () => {
    it('reads every configured calendar', async () => {
      const fetchMock = stubFetch({
        calendarIds: JSON.stringify(['family@group.calendar.google.com', 'work']),
        eventsByCalendar: { 'family@group.calendar.google.com': [], work: [] },
      })

      const { result } = renderHook(() => useMonthCalendar(IN_YEAR, IN_MONTH), {
        wrapper: wrapperFor(newClient()),
      })
      await waitFor(() => expect(result.current.data).not.toBeNull())

      expect(calendarsAsked(fetchMock)).toEqual(['family@group.calendar.google.com', 'work'])
    })

    it('falls back to the primary calendar when none is configured', async () => {
      const fetchMock = stubFetch({ eventsByCalendar: { primary: [] } })

      const { result } = renderHook(() => useMonthCalendar(IN_YEAR, IN_MONTH), {
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

      const { result } = renderHook(() => useMonthCalendar(IN_YEAR, IN_MONTH), {
        wrapper: wrapperFor(newClient()),
      })

      expect(result.current.isLoading).toBe(true)
      expect(eventUrls(fetchMock)).toHaveLength(0)

      await waitFor(() => expect(result.current.data).not.toBeNull())
      expect(calendarsAsked(fetchMock)).toEqual(['work'])
    })

    it('returns null (not undefined) until the first fetch succeeds', async () => {
      stubFetch({ calendarIds: JSON.stringify(['work']), eventsByCalendar: { work: [] } })

      const { result } = renderHook(() => useMonthCalendar(IN_YEAR, IN_MONTH), {
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

      const { result } = renderHook(() => useMonthCalendar(IN_YEAR, IN_MONTH), {
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

    // The window deliberately carries no previous data across a calendar-ids
    // change (its observers are positional over a runtime-length list), so
    // without the last completed month kept here the grid empties for the
    // length of a round trip every time the selected calendars change.
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

      const { result } = renderHook(() => useMonthCalendar(IN_YEAR, IN_MONTH), {
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
  })
})
