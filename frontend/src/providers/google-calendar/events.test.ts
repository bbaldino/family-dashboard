import { describe, expect, it, vi, afterEach } from 'vitest'
import { fetchCalendarEvents } from './events'
import type { CalendarEvent } from './types'

/**
 * `fetchCalendarEvents` knows the `/events` route and its query params, and
 * it *throws* when the request fails. Callers that need a failure isolated
 * per calendar — `useCalendarWindow`, `useCalendarRange` — call this once per
 * calendar and let react-query hold each error separately, rather than this
 * function ever swallowing one itself.
 *
 * A single-calendar consumer (countdowns) needs exactly that throw: routed
 * through something that swallowed the failure, a broken calendar would
 * render as "nothing coming up" forever.
 */

function event(id: string): CalendarEvent {
  return { id, summary: id, start: { date: '2026-08-07' }, end: { date: '2026-08-08' } }
}

/**
 * Serves `/api/google-calendar/events` per calendar id: a list resolves, an
 * `Error` fails the request the way the api client sees an upstream failure.
 */
function mockEventsFetch(byCalendar: Record<string, CalendarEvent[] | Error>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost')
    if (url.pathname !== '/api/google-calendar/events') {
      return Promise.reject(new Error(`Unexpected fetch url: ${String(input)}`))
    }
    const outcome = byCalendar[url.searchParams.get('calendar') ?? '']
    if (outcome === undefined) {
      return Promise.reject(new Error(`Unexpected calendar: ${String(input)}`))
    }
    const failed = outcome instanceof Error
    const body = failed ? { error: outcome.message } : outcome
    return Promise.resolve({
      ok: !failed,
      status: failed ? 500 : 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response)
  })
  globalThis.fetch = fetchMock as unknown as typeof fetch
  return fetchMock
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchCalendarEvents', () => {
  it('composes the events request for one calendar and window', async () => {
    const fetchMock = mockEventsFetch({ 'work@group.calendar.google.com': [event('a')] })

    const events = await fetchCalendarEvents(
      'work@group.calendar.google.com',
      '2026-08-07T00:00:00.000Z',
      '2026-08-14T00:00:00.000Z',
    )

    expect(events).toEqual([event('a')])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/google-calendar/events?calendar=work%40group.calendar.google.com&start=2026-08-07T00%3A00%3A00.000Z&end=2026-08-14T00%3A00%3A00.000Z',
      undefined,
    )
  })

  it('rejects when the calendar cannot be read', async () => {
    mockEventsFetch({ broken: new Error('calendar not found') })

    await expect(
      fetchCalendarEvents('broken', '2026-08-07T00:00:00.000Z', '2026-08-14T00:00:00.000Z'),
    ).rejects.toThrow('calendar not found')
  })
})
