import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGoogleCalendar } from './useGoogleCalendar'
import { CONFIG_QUERY_KEY } from '@/platform/useAllConfig'
import type { CalendarEvent } from '@/providers/google-calendar'

/**
 * The week strip's hook. It fetches nothing of its own any more: today plus
 * the next six days is inside the provider's synced window on every day of
 * every month, so this is a pure filter over it. What is pinned here:
 *
 * 1. **No request of its own.** The only `/events` traffic is the window
 *    sync's. This is the whole point of the change and is invisible
 *    otherwise — the strip looks identical either way.
 * 2. **The bucketing, labels and sort are unchanged.** Seven days from today,
 *    `Today 5/11` / `Tomorrow 5/12` / weekday, events in time order.
 * 3. **Config reactivity.** Editing `calendar.calendar_ids` in admin re-asks
 *    the new calendars with no remount. The tablet is a wall-mounted kiosk
 *    that never reloads, so "picked up on the next reload" means "never".
 * 4. **The `null`-before-success contract.** `PollResult.data` is `null`, not
 *    react-query's `undefined`, until a fetch has actually succeeded — see
 *    `useLunchMenu` for the fuller account.
 * 5. **`isLoading` covers the config wait too.** `ScheduleColumn` picks
 *    between "Fetching the week ahead…" and "Nothing on the books this week."
 *    on that flag alone.
 *
 * Timezone is pinned to America/Los_Angeles in vite.config.ts's test.env.
 */

const NOW = new Date('2026-05-11T09:00:00')
/** The window the provider syncs: one month back, five forward, aligned. */
const WINDOW_START = new Date(2026, 3, 1)
const WINDOW_END = new Date(2026, 10, 1)

function event(id: string, date: string): CalendarEvent {
  return { id, summary: id, start: { date }, end: { date } }
}

function timed(id: string, dateTime: string): CalendarEvent {
  return { id, summary: id, start: { dateTime }, end: { dateTime } }
}

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

function windowUrl(calendar: string): string {
  return `/api/google-calendar/events?calendar=${encodeURIComponent(calendar)}&start=${encodeURIComponent(WINDOW_START.toISOString())}&end=${encodeURIComponent(WINDOW_END.toISOString())}`
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

  it('reads the week from the synced window without asking for it separately', async () => {
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['family@group.calendar.google.com', 'work']),
      eventsByCalendar: {
        'family@group.calendar.google.com': [event('dentist', '2026-05-12')],
        work: [event('standup', '2026-05-13')],
      },
    })

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).not.toBeNull())

    // One request per calendar, for the window — not a second pair for the
    // seven days this hook happens to show.
    expect(eventUrls(fetchMock)).toEqual([
      windowUrl('family@group.calendar.google.com'),
      windowUrl('work'),
    ])

    const days = result.current.data!
    expect(days).toHaveLength(7)
    expect(days[0].isToday).toBe(true)
    expect(days[1].events.map((e) => e.id)).toEqual(['dentist'])
    expect(days[2].events.map((e) => e.id)).toEqual(['standup'])
  })

  it('ignores the window events that fall outside the seven days', async () => {
    stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: {
        work: [
          event('lastMonth', '2026-04-20'),
          event('yesterday', '2026-05-10'),
          event('today', '2026-05-11'),
          event('lastDayShown', '2026-05-17'),
          event('justAfter', '2026-05-18'),
          event('september', '2026-09-02'),
        ],
      },
    })

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(result.current.data!.flatMap((d) => d.events.map((e) => e.id))).toEqual([
      'today',
      'lastDayShown',
    ])
  })

  it('labels today, tomorrow and the weekdays after them', async () => {
    stubFetch({ calendarIds: JSON.stringify(['work']), eventsByCalendar: { work: [] } })

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(result.current.data!.map((d) => d.label)).toEqual([
      'Today 5/11',
      'Tomorrow 5/12',
      'Wednesday 5/13',
      'Thursday 5/14',
      'Friday 5/15',
      'Saturday 5/16',
      'Sunday 5/17',
    ])
  })

  it('sorts each day by start time', async () => {
    stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: {
        work: [
          timed('evening', '2026-05-12T19:00:00-07:00'),
          timed('morning', '2026-05-12T08:00:00-07:00'),
          timed('noon', '2026-05-12T12:00:00-07:00'),
        ],
      },
    })

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: wrapperFor(newClient()) })

    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(result.current.data![1].events.map((e) => e.id)).toEqual(['morning', 'noon', 'evening'])
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

    // Cold cache: `null`, not `undefined` — the `PollResult` contract.
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
        'calendar.calendar_ids': JSON.stringify(['home']),
      })
    })

    await waitFor(() => expect(calendarsAsked(fetchMock)).toEqual(['work', 'home']))
    await waitFor(() =>
      expect(result.current.data!.flatMap((d) => d.events.map((e) => e.id))).toEqual(['soccer']),
    )
  })

  // The window sync deliberately has no `keepPreviousData` — its observers are
  // positional over a runtime-length list, so carrying data across an id
  // change could file one calendar's events under another's. Not blanking is
  // therefore this hook's job, and it holds its own last completed week.
  it('keeps the previous week on screen while the new calendars are still fetching', async () => {
    let landHome = () => {}
    const homeInFlight = new Promise<void>((resolve) => {
      landHome = resolve
    })
    const fetchMock = stubFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: {
        work: [event('standup', '2026-05-12')],
        home: [event('soccer', '2026-05-12')],
      },
      hold: { home: homeInFlight },
    })
    const queryClient = newClient()

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: wrapperFor(queryClient) })

    await waitFor(() => expect(result.current.data).not.toBeNull())
    const eventIds = () => result.current.data?.flatMap((d) => d.events.map((e) => e.id))
    expect(eventIds()).toEqual(['standup'])

    act(() => {
      queryClient.setQueryData(CONFIG_QUERY_KEY, {
        'calendar.calendar_ids': JSON.stringify(['home']),
      })
    })

    // The new calendar's sync is out but deliberately unresolved. Last week's
    // days must still be what a caller reads — `data` neither null nor empty.
    await waitFor(() => expect(calendarsAsked(fetchMock)).toEqual(['work', 'home']))
    expect(result.current.data).not.toBeNull()
    expect(eventIds()).toEqual(['standup'])

    landHome()
    await waitFor(() => expect(eventIds()).toEqual(['soccer']))
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

  it('reports an error only once every calendar has failed', async () => {
    stubFetch({
      calendarIds: JSON.stringify(['broken', 'work']),
      eventsByCalendar: { work: [event('standup', '2026-05-12')] },
    })

    const { result } = renderHook(() => useGoogleCalendar(), { wrapper: wrapperFor(newClient()) })

    // One revoked share must not blank the week the others still describe.
    await waitFor(() => expect(result.current.data).not.toBeNull())
    expect(result.current.error).toBeNull()
    expect(result.current.data!.flatMap((d) => d.events.map((e) => e.id))).toEqual(['standup'])
  })
})
