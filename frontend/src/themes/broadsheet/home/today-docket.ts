import type { CalendarEvent } from '@/providers/google-calendar'
import { isAllDay, isBirthdayEvent } from './event-format'

/**
 * Today's events, sorted three ways: `allDay` for events with no clock time,
 * then the timed ones split by the clock — `earlier` holds what has already
 * ended, `ahead` everything still to come or under way. Each keeps the
 * calendar's order.
 *
 * The Today hero used to fill a few fixed rows in time order all day — on a
 * busy day (Halloween, 2026-10-31) the morning's finished events held every row
 * while the evening's sat behind "+N more today". Now `TodayDocket` lists
 * `earlier` above a NOW rule and `ahead` below it, scrolled to now, and the
 * hero puts `allDay` in a line of its own under the headline (`allDayLine`),
 * where scrolling can't carry the day's birthdays out of sight.
 *
 * An event is over at its end time, so one under way keeps its row. An event
 * with no readable end counts as over once it starts; one whose start can't be
 * read stays in `ahead`, because hiding an event is worse than showing a stale
 * one.
 *
 * Not `Home`'s `upcomingTodayEvents`: that one answers "what's next?" for the
 * masthead, so it drops an event the moment it *starts*.
 */
export function splitTodayDocket(
  events: CalendarEvent[],
  now: Date,
): { allDay: CalendarEvent[]; earlier: CalendarEvent[]; ahead: CalendarEvent[] } {
  const allDay: CalendarEvent[] = []
  const earlier: CalendarEvent[] = []
  const ahead: CalendarEvent[] = []
  for (const event of events) {
    if (isAllDay(event)) allDay.push(event)
    else if (hasEnded(event, now)) earlier.push(event)
    else ahead.push(event)
  }
  return { allDay, earlier, ahead }
}

/** A timed event that has started and not yet ended — `TodayDocket` tags it,
 *  since it sits below a NOW rule later than its own start time. */
export function isUnderWay(event: CalendarEvent, now: Date): boolean {
  if (!event.start.dateTime) return false
  const start = new Date(event.start.dateTime).getTime()
  return start <= now.getTime() && !hasEnded(event, now)
}

function hasEnded(event: CalendarEvent, now: Date): boolean {
  if (!event.start.dateTime) return false
  const start = new Date(event.start.dateTime).getTime()
  if (Number.isNaN(start)) return false
  const end = event.end.dateTime ? new Date(event.end.dateTime).getTime() : NaN
  return (Number.isNaN(end) ? start : end) <= now.getTime()
}

/** How many entries `allDayLine` names before counting the rest as "+N more". */
const MAX_ALL_DAY_ENTRIES = 3

/**
 * Today's all-day events as one compact line: "Birthdays: John Oxaal, Alaire
 * Orme · Halloween". Birthdays share a single entry that names each person —
 * the household's are all-day events, and a day can have several (2026-11-01
 * had two) — so they cost one entry however many there are. Past three
 * entries the rest are counted, not named; the hero also clips the line to
 * one row as a last resort.
 */
export function allDayLine(events: CalendarEvent[]): string {
  const names = events.filter(isBirthdayEvent).map(birthdayName)
  const entries = events.filter((e) => !isBirthdayEvent(e)).map((e) => e.summary || 'Untitled')
  if (names.length > 0) {
    entries.unshift(`${names.length === 1 ? 'Birthday' : 'Birthdays'}: ${names.join(', ')}`)
  }
  const shown = entries.slice(0, MAX_ALL_DAY_ENTRIES)
  const rest = entries.length - shown.length
  return [...shown, ...(rest > 0 ? [`+${rest} more`] : [])].join(' · ')
}

/** "John Oxaal's birthday" → "John Oxaal"; "Grandpa Birthday" → "Grandpa". */
function birthdayName(event: CalendarEvent): string {
  return (event.summary ?? '').trim().replace(/(?:'s)?\s+birthday$/i, '')
}
