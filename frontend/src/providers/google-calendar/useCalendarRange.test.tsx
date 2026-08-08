import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAllConfig } from '@/platform'
import { useCalendarRange } from './useCalendarRange'
import type { CalendarEvent } from './types'

/**
 * The resolver every ranged consumer reads through: contained in the synced
 * window means no network at all, outside it means a fetch expanded to whole
 * months.
 *
 * The sharp case is the **straddle**. `AssignmentsTab` pages weeks with no
 * clamp, so a week that begins before the window and ends inside it is
 * reachable in five clicks — and if the outside days were dropped the row
 * would render plausibly, with two columns quietly empty. That is the bug
 * this file exists to hold shut.
 *
 * Timezone is pinned to America/Los_Angeles in vite.config.ts's test.env.
 */

const NOW = new Date('2026-05-11T09:00:00')
/** One month back, five months forward, month-aligned: Apr 1 through Nov 1. */
const WINDOW_START = new Date(2026, 3, 1)
const WINDOW_END = new Date(2026, 10, 1)

/** A week wholly inside the window. */
const IN_START = new Date(2026, 4, 11)
const IN_END = new Date(2026, 4, 18)

/** A week wholly before it — March is outside entirely. */
const OUT_START = new Date(2026, 2, 9)
const OUT_END = new Date(2026, 2, 16)

/** A week that begins outside and ends inside: Mon Mar 30 – Sun Apr 5. */
const STRADDLE_START = new Date(2026, 2, 30)
const STRADDLE_END = new Date(2026, 3, 6)

function allDay(id: string, date: string): CalendarEvent {
  return { id, summary: id, start: { date }, end: { date } }
}

function spanning(id: string, from: string, to: string): CalendarEvent {
  return { id, summary: id, start: { date: from }, end: { date: to } }
}

function eventBounds(event: CalendarEvent): { start: number; end: number } {
  const startStr = event.start.dateTime ?? event.start.date ?? ''
  const endStr = event.end.dateTime ?? event.end.date ?? startStr
  const start = new Date(event.start.dateTime ? startStr : `${startStr}T00:00:00`).getTime()
  const end = new Date(event.end.dateTime ? endStr : `${endStr}T00:00:00`).getTime()
  return { start, end: Math.max(end, start + 1) }
}

interface ServerOptions {
  /** Value stored at `calendar.calendar_ids`, if any. */
  calendarIds?: string
  /** Events per calendar id; a missing id responds 500. */
  eventsByCalendar: Record<string, CalendarEvent[]>
  /**
   * Fail every request that is *not* the window sync's own, so the account is
   * plainly readable and only an out-of-window month is broken.
   */
  failExpansions?: boolean
}

/**
 * Serves `/events` the way Google does: everything **overlapping** the asked
 * range, not everything starting in it. That is what makes a multi-day event
 * come back from two adjacent month requests, which is why the resolver has
 * to de-duplicate.
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
      const startStr = params.get('start') ?? ''
      const endStr = params.get('end') ?? ''
      const isWindow =
        startStr === WINDOW_START.toISOString() && endStr === WINDOW_END.toISOString()
      if (options.failExpansions && !isWindow) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'month unavailable' }),
        } as Response)
      }
      const from = new Date(startStr).getTime()
      const to = new Date(endStr).getTime()
      const overlapping = events.filter((e) => {
        const bounds = eventBounds(e)
        return bounds.start < to && bounds.end > from
      })
      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(overlapping)),
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

/** How a consumer calls it: its own config key, the provider's resolution. */
function useRangeFromConfig(start: Date, end: Date) {
  const { data } = useAllConfig()
  return useCalendarRange(data?.['calendar.calendar_ids'], start, end)
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useCalendarRange', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('inside the window', () => {
    it('resolves from the window with no request of its own', async () => {
      const fetchMock = stubFetch({
        calendarIds: JSON.stringify(['home', 'work']),
        eventsByCalendar: {
          home: [allDay('soccer', '2026-05-12')],
          work: [allDay('standup', '2026-05-13')],
        },
      })

      const { result } = renderHook(() => useRangeFromConfig(IN_START, IN_END), {
        wrapper: wrapperFor(newClient()),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      expect(result.current.events.map((e) => e.id).sort()).toEqual(['soccer', 'standup'])

      // The window sync's own requests and nothing else. This is the entire
      // point: the range is already in memory, so asking for it again is a
      // round trip that buys nothing.
      expect(requestsMade(fetchMock)).toEqual([windowRequest('home'), windowRequest('work')])
    })

    it('returns only the events in the asked range, not the whole window', async () => {
      stubFetch({
        calendarIds: JSON.stringify(['home']),
        eventsByCalendar: {
          home: [
            allDay('before', '2026-05-10'),
            allDay('inside', '2026-05-12'),
            allDay('after', '2026-05-18'),
            allDay('far', '2026-09-01'),
          ],
        },
      })

      const { result } = renderHook(() => useRangeFromConfig(IN_START, IN_END), {
        wrapper: wrapperFor(newClient()),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))
      // `end` is exclusive, so the 18th is out by a day.
      expect(result.current.events.map((e) => e.id)).toEqual(['inside'])
    })
  })

  describe('outside the window', () => {
    it('fetches the whole month rather than the exact range', async () => {
      const fetchMock = stubFetch({
        calendarIds: JSON.stringify(['home']),
        eventsByCalendar: { home: [allDay('recital', '2026-03-11')] },
      })

      const { result } = renderHook(() => useRangeFromConfig(OUT_START, OUT_END), {
        wrapper: wrapperFor(newClient()),
      })

      await waitFor(() => expect(result.current.events).toHaveLength(1))
      expect(result.current.events.map((e) => e.id)).toEqual(['recital'])

      // Whole months, so that paging a week either way lands on a range
      // already in cache instead of a new one overlapping it by six days.
      expect(requestsMade(fetchMock)).toEqual([
        windowRequest('home'),
        monthRequest('home', 2026, 2),
      ])
    })

    it('serves a month it has already fetched from cache when paged back to', async () => {
      const fetchMock = stubFetch({
        calendarIds: JSON.stringify(['home']),
        eventsByCalendar: { home: [allDay('recital', '2026-03-11')] },
      })

      const { result, rerender } = renderHook(
        ({ start, end }: { start: Date; end: Date }) => useRangeFromConfig(start, end),
        { wrapper: wrapperFor(newClient()), initialProps: { start: OUT_START, end: OUT_END } },
      )

      await waitFor(() => expect(result.current.events).toHaveLength(1))
      const afterFirstVisit = requestsMade(fetchMock).length

      // Page into the window, then back out to the same month.
      rerender({ start: IN_START, end: IN_END })
      await waitFor(() => expect(result.current.events).toHaveLength(0))
      rerender({ start: OUT_START, end: OUT_END })
      await waitFor(() => expect(result.current.events).toHaveLength(1))

      expect(requestsMade(fetchMock)).toHaveLength(afterFirstVisit)
    })

    it('says which calendar failed outside the window, as identifiably as inside it', async () => {
      stubFetch({
        calendarIds: JSON.stringify(['broken', 'quiet']),
        eventsByCalendar: { quiet: [] },
      })

      const { result } = renderHook(() => useRangeFromConfig(OUT_START, OUT_END), {
        wrapper: wrapperFor(newClient()),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      const byId = Object.fromEntries(result.current.calendars.map((c) => [c.calendarId, c]))
      // Both hold nothing; only one of them is a problem. Losing this outside
      // the window would reintroduce, for exactly the months someone is
      // paging through, the confusion the per-calendar split removed.
      expect(byId.broken.events).toEqual([])
      expect(byId.quiet.events).toEqual([])
      expect(byId.broken.error?.message).toBe('calendar unavailable')
      expect(byId.quiet.error).toBeNull()
    })
  })

  describe('straddling the window edge', () => {
    it('returns the days outside the window as well as the days inside it', async () => {
      const fetchMock = stubFetch({
        calendarIds: JSON.stringify(['home']),
        eventsByCalendar: {
          home: [
            allDay('outsideMonday', '2026-03-30'),
            allDay('outsideTuesday', '2026-03-31'),
            allDay('insideThursday', '2026-04-02'),
          ],
        },
      })

      const { result } = renderHook(() => useRangeFromConfig(STRADDLE_START, STRADDLE_END), {
        wrapper: wrapperFor(newClient()),
      })

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      // Dropping the two outside days is the failure that renders plausibly:
      // a week grid with Monday and Tuesday quietly blank.
      await waitFor(() =>
        expect(result.current.events.map((e) => e.id).sort()).toEqual([
          'insideThursday',
          'outsideMonday',
          'outsideTuesday',
        ]),
      )

      // Only the month the window does not already hold is fetched — April is
      // in memory, and asking for it again would undo the saving.
      expect(requestsMade(fetchMock)).toEqual([
        windowRequest('home'),
        monthRequest('home', 2026, 2),
      ])
    })

    it('lists an event spanning the window edge once, not once per source', async () => {
      stubFetch({
        calendarIds: JSON.stringify(['home']),
        eventsByCalendar: { home: [spanning('springBreak', '2026-03-30', '2026-04-04')] },
      })

      const { result } = renderHook(() => useRangeFromConfig(STRADDLE_START, STRADDLE_END), {
        wrapper: wrapperFor(newClient()),
      })

      // The March fetch and the window both overlap it, so both return it.
      await waitFor(() => expect(result.current.events).toHaveLength(1))
      expect(result.current.events[0].id).toBe('springBreak')
    })
  })

  describe('what counts as the range being unusable', () => {
    it('does not report a range-level error when only the expansion failed', async () => {
      stubFetch({
        calendarIds: JSON.stringify(['home']),
        eventsByCalendar: { home: [allDay('recital', '2026-03-11')] },
        failExpansions: true,
      })

      const { result } = renderHook(() => useRangeFromConfig(OUT_START, OUT_END), {
        wrapper: wrapperFor(newClient()),
      })

      await waitFor(() => expect(result.current.calendars[0].error).not.toBeNull())

      // The account is readable — the window synced fine. `CalendarBoard`
      // turns a range-level error into "Connect Google Calendar in Settings",
      // which would send someone to fix something that is not broken.
      expect(result.current.error).toBeNull()
      // Still visible to a caller that wants to say "this month didn't load".
      expect(result.current.calendars[0].error?.message).toBe('month unavailable')
    })

    it('keeps the in-window days of a straddling range when its expansion failed', async () => {
      stubFetch({
        calendarIds: JSON.stringify(['home']),
        eventsByCalendar: {
          home: [allDay('outsideMonday', '2026-03-30'), allDay('insideThursday', '2026-04-02')],
        },
        failExpansions: true,
      })

      const { result } = renderHook(() => useRangeFromConfig(STRADDLE_START, STRADDLE_END), {
        wrapper: wrapperFor(newClient()),
      })

      await waitFor(() => expect(result.current.calendars[0].error).not.toBeNull())

      // April is already in memory. Discarding it because March would not
      // load throws away events we hold, on top of the wrong diagnosis.
      expect(result.current.events.map((e) => e.id)).toEqual(['insideThursday'])
      expect(result.current.error).toBeNull()
    })

    it('does report a range-level error once the window has failed for every calendar', async () => {
      stubFetch({ calendarIds: JSON.stringify(['broken', 'alsoBroken']), eventsByCalendar: {} })

      const { result } = renderHook(() => useRangeFromConfig(IN_START, IN_END), {
        wrapper: wrapperFor(newClient()),
      })

      // Nothing is readable at all, which is the state "Connect Google
      // Calendar in Settings" is actually for.
      await waitFor(() => expect(result.current.error?.message).toBe('calendar unavailable'))
    })
  })

  it('waits for the config before asking, so it never resolves against the wrong calendar', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: { work: [] },
    })

    const { result } = renderHook(() => useRangeFromConfig(OUT_START, OUT_END), {
      wrapper: wrapperFor(newClient()),
    })

    expect(result.current.isLoading).toBe(true)
    expect(eventUrls(fetchMock)).toHaveLength(0)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(requestsMade(fetchMock)).toEqual([windowRequest('work'), monthRequest('work', 2026, 2)])
  })
})
