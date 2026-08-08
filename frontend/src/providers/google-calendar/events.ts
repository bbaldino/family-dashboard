import { googleCalendarProvider } from './config'
import type { CalendarEvent } from './types'

/**
 * The `/events` route and its query params, as a path.
 *
 * Split out of `fetchCalendarEvents` for the one caller that needs the URL
 * without fetching it: `useCalendarWindow` keys its per-calendar queries on
 * the request they make (`integrationQueryKey`), and composing that string a
 * second time in the hook is exactly the hand-written duplicate the note
 * below says must not exist.
 */
export function calendarEventsPath(calendarId: string, startStr: string, endStr: string): string {
  return `/events?calendar=${encodeURIComponent(calendarId)}&start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`
}

/**
 * One calendar's events in one window.
 *
 * The single place that knows the `/events` route and its query params, so no
 * consumer hand-composes that URL — countdowns used to, which is how it ended
 * up reaching into another integration's api client for it.
 *
 * **It throws.** Whether a failure is worth surfacing is the caller's
 * decision, not this function's: a consumer reading one calendar has nothing
 * left to show when that calendar breaks, and must be able to say so rather
 * than render an empty list forever. `fetchEventsForCalendars` is the caller
 * that decides otherwise, and it decides it for itself.
 */
export function fetchCalendarEvents(
  calendarId: string,
  startStr: string,
  endStr: string,
): Promise<CalendarEvent[]> {
  return googleCalendarProvider.api.get<CalendarEvent[]>(
    calendarEventsPath(calendarId, startStr, endStr),
  )
}

/**
 * Ask each of several calendars for one window and flatten the answers.
 *
 * The three view callers — the week strip, the month grid and the chore
 * assignments row — want the same events bucketed three different ways, so
 * only the fan-out is shared; the bucketing stays with each caller.
 *
 * Each request catches its own failure, and that is this function's policy
 * rather than the fetch's: a household with several calendars has several
 * ways to lose one (a revoked share, a deleted calendar), and one of them
 * failing must not blank the rest. The same swallow applied to a lone
 * calendar would be a silent, permanent empty — hence the split.
 */
export async function fetchEventsForCalendars(
  calendarIds: string[],
  startStr: string,
  endStr: string,
): Promise<CalendarEvent[]> {
  const results = await Promise.all(
    calendarIds.map((id) => fetchCalendarEvents(id, startStr, endStr).catch(() => [])),
  )
  return results.flat()
}
