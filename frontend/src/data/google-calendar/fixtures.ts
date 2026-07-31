/**
 * Named calendar states for `?scenario=<name>` (see `@/data/scenario`),
 * typed as `MonthEvents` and `CalendarDay[]` — the *real* return shapes of
 * `useMonthCalendar` and `useGoogleCalendar`, imported from those hook
 * modules rather than redeclared. If either hook's shape changes, these
 * fixtures stop compiling instead of silently drifting out of sync.
 *
 * Scenarios are the month grid's interesting layout states, chosen because
 * the live calendar rarely contains them:
 * - `empty`    — no events at all.
 * - `packed`   — several busy days, one with more events than a day cell
 *                can show.
 * - `spanning` — a multi-day event crossing a month boundary, plus an
 *                all-day and a timed event landing on the same day (tests
 *                the sort rule: all-day first, then chronological).
 *
 * To add a fixture set for another integration: write a sibling
 * `fixtures.ts` next to that integration's hook(s), export functions typed
 * against the hook's real return type, and have the hook check them the
 * same way `useMonthCalendar`/`useGoogleCalendar` do below — look up
 * `activeScenario` from `@/data/scenario`, and fall through to the normal
 * fetch when it's `null` or not a scenario this integration defines.
 */
import { toLocalDateStr } from '@/utils/date'
import type { CalendarEvent } from './types'
import type { MonthEvents } from './useMonthCalendar'
import type { CalendarDay } from './useGoogleCalendar'

export type CalendarScenario = 'empty' | 'packed' | 'spanning'

function isCalendarScenario(name: string): name is CalendarScenario {
  return name === 'empty' || name === 'packed' || name === 'spanning'
}

// ─── event builders ──────────────────────────────────────────────

function allDayEvent(id: string, summary: string, start: Date, endExclusive: Date): CalendarEvent {
  return {
    id,
    summary,
    start: { date: toLocalDateStr(start) },
    end: { date: toLocalDateStr(endExclusive) },
  }
}

function timedEvent(
  id: string,
  summary: string,
  start: Date,
  durationMinutes: number,
  location?: string,
): CalendarEvent {
  const end = new Date(start.getTime() + durationMinutes * 60_000)
  return {
    id,
    summary,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    ...(location ? { location } : {}),
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function atTime(date: Date, hour: number, minute: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute)
}

function addOnDay(byDate: Record<string, CalendarEvent[]>, date: Date, event: CalendarEvent): void {
  const key = toLocalDateStr(date)
  ;(byDate[key] ??= []).push(event)
}

/** Adds `event` to `byDate` for every local day it spans — `endExclusive`
 *  follows Google Calendar's all-day convention, matching the expansion
 *  `useMonthCalendar`'s own fetch performs on real multi-day events. */
function addSpanning(
  byDate: Record<string, CalendarEvent[]>,
  event: CalendarEvent,
  start: Date,
  endExclusive: Date,
): void {
  for (let cursor = new Date(start); cursor < endExclusive; cursor = addDays(cursor, 1)) {
    addOnDay(byDate, cursor, event)
  }
}

/** Mirrors `useMonthCalendar`'s own per-day sort: all-day events first,
 *  then timed events in chronological order. */
function sortDays(byDate: Record<string, CalendarEvent[]>): void {
  for (const events of Object.values(byDate)) {
    events.sort((a, b) => {
      const aAllDay = !a.start.dateTime
      const bAllDay = !b.start.dateTime
      if (aAllDay && !bAllDay) return -1
      if (!aAllDay && bAllDay) return 1
      const aTime = a.start.dateTime ?? a.start.date ?? ''
      const bTime = b.start.dateTime ?? b.start.date ?? ''
      return aTime.localeCompare(bTime)
    })
  }
}

// ─── month grid fixtures ─────────────────────────────────────────

function emptyMonth(): MonthEvents {
  return { byDate: {} }
}

function packedMonth(year: number, month: number): MonthEvents {
  const byDate: Record<string, CalendarEvent[]> = {}
  const day = (n: number) => new Date(year, month, n)

  addOnDay(byDate, day(3), allDayEvent('school-photo-day', 'School photo day', day(3), day(4)))

  addOnDay(byDate, day(8), timedEvent('piano-leo', 'Piano lesson — Leo', atTime(day(8), 16, 0), 45))
  addOnDay(byDate, day(8), timedEvent('grocery-pickup', 'Grocery pickup', atTime(day(8), 17, 30), 30))

  // The crowded day: six events on one cell — more than the grid's four
  // visible pills, so it must show a "+N more" overflow.
  addOnDay(byDate, day(14), timedEvent('drop-off', 'School drop-off', atTime(day(14), 7, 15), 20))
  addOnDay(byDate, day(14), timedEvent('dentist-mia', 'Dentist — Mia', atTime(day(14), 9, 0), 45, 'Riverside Pediatric Dental'))
  addOnDay(byDate, day(14), allDayEvent('trash-pickup', 'Trash pickup', day(14), day(15)))
  addOnDay(byDate, day(14), timedEvent('soccer-practice', 'Soccer practice', atTime(day(14), 16, 0), 60, 'Lincoln Park Fields'))
  addOnDay(byDate, day(14), timedEvent('piano-mia', 'Piano lesson — Mia', atTime(day(14), 17, 0), 45))
  addOnDay(byDate, day(14), timedEvent('book-club', 'Book club', atTime(day(14), 19, 0), 90))

  addOnDay(byDate, day(19), allDayEvent('conferences', 'Parent-teacher conferences', day(19), day(20)))
  addOnDay(byDate, day(19), timedEvent('ortho-leo', 'Orthodontist — Leo', atTime(day(19), 15, 30), 45))

  addOnDay(byDate, day(24), timedEvent('grocery-run', 'Grocery run', atTime(day(24), 10, 0), 45))
  addOnDay(byDate, day(24), timedEvent('birthday-emma', 'Birthday party — Emma', atTime(day(24), 13, 0), 120))
  addOnDay(byDate, day(24), timedEvent('movie-night', 'Family movie night', atTime(day(24), 19, 0), 100))

  sortDays(byDate)
  return { byDate }
}

function spanningMonth(year: number, month: number): MonthEvents {
  const byDate: Record<string, CalendarEvent[]> = {}
  const firstOfMonth = new Date(year, month, 1)

  // A visit spanning the month boundary: starts two days before the
  // displayed month begins, ends (exclusive) two days into it.
  const tripStart = addDays(firstOfMonth, -2)
  const tripEndExclusive = addDays(firstOfMonth, 2)
  const trip = allDayEvent('grandma-visit', 'Grandma visiting', tripStart, tripEndExclusive)
  addSpanning(byDate, trip, tripStart, tripEndExclusive)

  // The trip's last day also carries another all-day event and a timed
  // one, to exercise the sort rule: all-day first, then chronological.
  const lastTripDay = addDays(tripEndExclusive, -1)
  addOnDay(byDate, lastTripDay, allDayEvent('half-day', 'Half-day dismissal', lastTripDay, addDays(lastTripDay, 1)))
  addOnDay(
    byDate,
    lastTripDay,
    timedEvent('checkup', 'Orthodontist checkup', atTime(lastTripDay, 10, 0), 30),
  )

  sortDays(byDate)
  return { byDate }
}

const monthFixtures: Record<CalendarScenario, (year: number, month: number) => MonthEvents> = {
  empty: emptyMonth,
  packed: packedMonth,
  spanning: spanningMonth,
}

/** The `MonthEvents` fixture for `scenario`, or `undefined` if no scenario
 *  is active or this integration doesn't define one by that name — in
 *  which case the caller should fetch live data as usual. */
export function monthFixtureFor(scenario: string | null, year: number, month: number): MonthEvents | undefined {
  if (!scenario || !isCalendarScenario(scenario)) return undefined
  return monthFixtures[scenario](year, month)
}

// ─── rolling-week fixtures ───────────────────────────────────────

function dayLabel(date: Date, today: Date): string {
  const diff = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const short = date.toLocaleDateString([], { month: 'numeric', day: 'numeric' })
  if (diff === 0) return `Today ${short}`
  if (diff === 1) return `Tomorrow ${short}`
  return `${date.toLocaleDateString([], { weekday: 'long' })} ${short}`
}

function buildWeek(eventsForOffset: (offset: number, date: Date) => CalendarEvent[]): CalendarDay[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days: CalendarDay[] = []
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(today, offset)
    days.push({
      date,
      label: dayLabel(date, today),
      isToday: offset === 0,
      events: eventsForOffset(offset, date),
    })
  }
  return days
}

function emptyWeek(): CalendarDay[] {
  return buildWeek(() => [])
}

function packedWeek(): CalendarDay[] {
  return buildWeek((offset, date) => {
    switch (offset) {
      case 0:
        // Today, deliberately overloaded — the Today hero renders every
        // event uncapped, which is exactly what this scenario is for.
        return [
          timedEvent('drop-off', 'School drop-off', atTime(date, 7, 15), 20),
          timedEvent('dentist-mia', 'Dentist — Mia', atTime(date, 9, 0), 45, 'Riverside Pediatric Dental'),
          timedEvent('soccer-practice', 'Soccer practice', atTime(date, 16, 0), 60, 'Lincoln Park Fields'),
          timedEvent('piano-leo', 'Piano lesson — Leo', atTime(date, 17, 0), 45),
          timedEvent('grocery-pickup', 'Grocery pickup', atTime(date, 18, 0), 30),
          timedEvent('book-club', 'Book club', atTime(date, 19, 30), 90),
        ]
      case 1:
        return [
          timedEvent('early-drop-off', 'Early drop-off — field trip', atTime(date, 7, 30), 15),
          timedEvent('ortho-leo', 'Orthodontist — Leo', atTime(date, 15, 30), 45),
          timedEvent('swim-team', 'Swim team', atTime(date, 17, 30), 60),
        ]
      case 2:
        return [
          allDayEvent('teacher-workday', 'Teacher workday — no school', date, addDays(date, 1)),
          timedEvent('pediatrician', 'Pediatrician checkup', atTime(date, 10, 0), 30),
        ]
      case 3:
        return [
          timedEvent('piano-mia', 'Piano lesson — Mia', atTime(date, 16, 30), 45),
          timedEvent('grocery-run', 'Grocery run', atTime(date, 17, 30), 45),
          timedEvent('family-dinner', 'Family dinner — Grandma visiting', atTime(date, 18, 30), 90),
        ]
      case 4:
        return [timedEvent('soccer-practice-2', 'Soccer practice', atTime(date, 16, 0), 60)]
      case 5:
        return [
          timedEvent('birthday-emma', 'Birthday party — Emma', atTime(date, 13, 0), 120),
          timedEvent('movie-night', 'Family movie night', atTime(date, 19, 0), 100),
        ]
      default:
        return []
    }
  })
}

function spanningWeek(): CalendarDay[] {
  return buildWeek((offset, date) => {
    if (offset !== 3) return []
    // A visit that starts mid-week and continues past the visible week —
    // `useGoogleCalendar` buckets purely by start date, so it appears once.
    return [
      allDayEvent('grandma-visit', 'Grandma visiting', date, addDays(date, 4)),
      timedEvent('airport-pickup', 'Airport pickup', atTime(date, 18, 0), 60),
    ]
  })
}

const weekFixtures: Record<CalendarScenario, () => CalendarDay[]> = {
  empty: emptyWeek,
  packed: packedWeek,
  spanning: spanningWeek,
}

/** The rolling-week `CalendarDay[]` fixture for `scenario`, or `undefined`
 *  if no scenario is active or this integration doesn't define one by that
 *  name — in which case the caller should fetch live data as usual. */
export function weekFixtureFor(scenario: string | null): CalendarDay[] | undefined {
  if (!scenario || !isCalendarScenario(scenario)) return undefined
  return weekFixtures[scenario]()
}
