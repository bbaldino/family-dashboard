import type { MonthEvents } from '@/integrations/calendar'
import { isBirthdayEvent } from '@/themes/broadsheet/home/event-format'

export interface MonthTally {
  eventCount: number
  birthdayCount: number
}

/**
 * The mock's Tally shows `62 events · 11 birthdays · 5 flights`. Of those:
 * - Events are directly countable from the month's data.
 * - Birthdays are classified by the shared `isBirthdayEvent` (an all-day event
 *   whose title ends in "birthday") — see `home/event-format.ts` for the
 *   heuristic and its reasoning. Matching only the ending, and only all-day
 *   events, keeps out the household's timed "bday party" events and titles that
 *   mention a birthday incidentally mid-string.
 * - Flights have no data source in this codebase at all — not fetched,
 *   not modeled anywhere — so there's no field to count them from. Not
 *   included in `MonthTally`, and the Datebook must not render a flights
 *   figure.
 */

/** Counts events (and, within them, birthdays) whose day falls in
 *  `year`/`month` (0-indexed) — `monthEvents.byDate` also carries the grid's
 *  leading/trailing adjacent-month padding days, and the Tally is for "this
 *  month" specifically. A spanning multi-day event appears once per day it
 *  touches in `byDate` (`useMonthCalendar` already expands it that way); it
 *  is de-duplicated by id here so it counts once rather than once per day.
 *
 *  Takes only `byDate`, not a whole `MonthEvents`. Multi-day events are also
 *  carried separately in `spans` for the banner layout, but counting them from
 *  there as well would double them — reading one field is the signature saying
 *  so. */
export function computeMonthTally(
  monthEvents: Pick<MonthEvents, 'byDate'>,
  year: number,
  month: number,
): MonthTally {
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const eventIds = new Set<string>()
  const birthdayIds = new Set<string>()

  for (const [dateKey, events] of Object.entries(monthEvents.byDate)) {
    if (!dateKey.startsWith(monthPrefix)) continue
    for (const event of events) {
      eventIds.add(event.id)
      if (isBirthdayEvent(event)) birthdayIds.add(event.id)
    }
  }

  return { eventCount: eventIds.size, birthdayCount: birthdayIds.size }
}
