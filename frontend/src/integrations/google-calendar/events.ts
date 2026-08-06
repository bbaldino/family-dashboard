import { googleCalendarIntegration } from './config'
import type { CalendarEvent } from './types'

/**
 * Ask each configured calendar for one window and flatten the answers.
 *
 * The three callers — the week strip, the month grid and the chore
 * assignments row — want the same events bucketed three different ways, so
 * only the fan-out is shared; the bucketing stays with each caller.
 *
 * Each request catches its own failure. A household with several calendars
 * has several ways to lose one (a revoked share, a deleted calendar), and one
 * of them failing must not blank the rest.
 */
export async function fetchEventsForCalendars(
  calendarIds: string[],
  startStr: string,
  endStr: string,
): Promise<CalendarEvent[]> {
  const results = await Promise.all(
    calendarIds.map((id) =>
      googleCalendarIntegration.api
        .get<CalendarEvent[]>(
          `/events?calendar=${encodeURIComponent(id)}&start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`,
        )
        .catch(() => []),
    ),
  )
  return results.flat()
}
