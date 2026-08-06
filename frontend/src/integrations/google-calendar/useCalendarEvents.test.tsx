import { describe, expect, it, vi, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCalendarEvents } from './useCalendarEvents'
import type { CalendarEvent } from './types'

/**
 * Pins the fan-out `AssignmentsTab` used to do by hand: read the configured
 * calendar ids, ask each one for the same window, and flatten. The two
 * properties worth pinning are the ones a caller would otherwise have to
 * remember — the `['primary']` fallback, and that one dead calendar must not
 * take the others down with it.
 */

const START = new Date('2026-05-11T07:00:00.000Z')
const END = new Date('2026-05-18T07:00:00.000Z')

function event(id: string): CalendarEvent {
  return {
    id,
    summary: id,
    start: { dateTime: '2026-05-12T17:00:00-07:00' },
    end: { dateTime: '2026-05-12T18:00:00-07:00' },
  }
}

interface ServerOptions {
  /** Value stored at `google-calendar.calendar_ids`, if any. */
  calendarIds?: string
  /** Events per calendar id; a missing id responds 500. */
  eventsByCalendar: Record<string, CalendarEvent[]>
}

function mockFetch(options: ServerOptions) {
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
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function eventUrls(fetchMock: ReturnType<typeof mockFetch>): string[] {
  return fetchMock.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => url.startsWith('/api/google-calendar/events'))
}

describe('useCalendarEvents', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks every configured calendar for the requested window and flattens the results', async () => {
    const fetchMock = mockFetch({
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
      `/api/google-calendar/events?calendar=${encodeURIComponent('family@group.calendar.google.com')}&start=${encodeURIComponent(START.toISOString())}&end=${encodeURIComponent(END.toISOString())}`,
      `/api/google-calendar/events?calendar=work&start=${encodeURIComponent(START.toISOString())}&end=${encodeURIComponent(END.toISOString())}`,
    ])
  })

  it('falls back to the primary calendar when none is configured', async () => {
    const fetchMock = mockFetch({ eventsByCalendar: { primary: [event('lunch')] } })

    const { result } = renderHook(() => useCalendarEvents(START, END), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data!.map((e) => e.id)).toEqual(['lunch'])
    expect(eventUrls(fetchMock)).toHaveLength(1)
    expect(eventUrls(fetchMock)[0]).toContain('calendar=primary')
  })

  it('keeps the surviving calendars when one of them fails', async () => {
    // The row this feeds is a week of chores; one broken calendar blanking the
    // whole row is exactly what the per-calendar catch is there to prevent.
    mockFetch({
      calendarIds: JSON.stringify(['broken', 'work']),
      eventsByCalendar: { work: [event('standup')] },
    })

    const { result } = renderHook(() => useCalendarEvents(START, END), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data!.map((e) => e.id)).toEqual(['standup'])
    expect(result.current.isError).toBe(false)
  })

  it('waits for the config before asking, so it never requests the wrong calendar first', async () => {
    const fetchMock = mockFetch({
      calendarIds: JSON.stringify(['work']),
      eventsByCalendar: { work: [event('standup')] },
    })

    const { result } = renderHook(() => useCalendarEvents(START, END), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.data).toBeDefined())
    // Not a wasted round-trip against `primary` followed by a corrective one:
    // the ids are known before the first request goes out.
    expect(eventUrls(fetchMock)).toHaveLength(1)
    expect(eventUrls(fetchMock)[0]).toContain('calendar=work')
  })
})
