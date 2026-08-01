import type { CalendarEvent, MonthEvents } from '@/data/google-calendar'

export interface MonthTally {
  eventCount: number
  birthdayCount: number
}

/**
 * The mock's Tally shows `62 events · 11 birthdays · 5 flights`. Of those:
 * - Events are directly countable from the month's data.
 * - Birthdays aren't classified anywhere in this codebase. Google surfaces
 *   *contact* birthdays as all-day events whose summary ends in
 *   "'s birthday" — a conservative heuristic, checked against this
 *   household's real calendar before relying on it (see the task report:
 *   zero events matched across a ~13-month window, because no Contacts
 *   birthday calendar is among the three calendars this household has
 *   selected — the heuristic is sound, it simply has nothing to catch here
 *   today). Anything looser (matching "birthday" anywhere, or the
 *   free-text "bday"/"b-day" spellings this household's own calendar
 *   actually uses for birthday *parties*) would also catch graduations,
 *   trips, and errands with "birthday" incidentally in the title — worse
 *   than reporting nothing.
 * - Flights have no data source in this codebase at all — not fetched,
 *   not modeled anywhere — so there's no field to count them from. Not
 *   included in `MonthTally`, and the Datebook must not render a flights
 *   figure.
 */
function isBirthdayEvent(event: CalendarEvent): boolean {
  if (event.start.dateTime) return false // must be all-day
  return /'s birthday$/i.test((event.summary ?? '').trim())
}

/** Counts events (and, within them, birthdays) whose day falls in
 *  `year`/`month` (0-indexed) — `monthEvents.byDate` also carries the grid's
 *  leading/trailing adjacent-month padding days, and the Tally is for "this
 *  month" specifically. A spanning multi-day event appears once per day it
 *  touches in `byDate` (`useMonthCalendar` already expands it that way); it
 *  is de-duplicated by id here so it counts once rather than once per day. */
export function computeMonthTally(monthEvents: MonthEvents, year: number, month: number): MonthTally {
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
