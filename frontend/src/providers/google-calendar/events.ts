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
 * than render an empty list forever. `useCalendarWindow` and `useCalendarRange`
 * call this once per calendar and let react-query hold each query's error
 * separately, so a failed calendar is isolated *and* identifiable rather than
 * silently empty.
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
