/**
 * The calendar days the month grid displays, grouped into week rows.
 *
 * This mirrors `useMonthCalendar`'s own gridStart/gridEnd computation
 * exactly (`src/data/google-calendar/useMonthCalendar.ts`) rather than
 * assuming a fixed six-row grid the way the design mock's hand-written
 * fixture data does. That distinction matters: the mock hardcodes 42 cells
 * because its one example month (May 2026) happens to need six weeks, but
 * most months don't. Checked computationally across 2025-2028: the large
 * majority of months need exactly 5 weeks, several need only 4 (e.g.
 * February 2026), and only a handful need 6. `useMonthCalendar` only
 * fetches the exact date range its own gridStart/gridEnd span — a UI that
 * always renders 6 rows would show a blank trailing week for any month that
 * needs fewer, and that week's cells would be wrong, not just empty: their
 * events were never fetched at all, so a real event landing there would
 * silently fail to appear. Rendering exactly as many weeks as the data
 * layer actually covers keeps every visible cell backed by fetched data.
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Every date the grid displays for `year`/`month` (0-indexed), Sunday
 *  through the Saturday that closes out the month's last week. */
export function getMonthGridDates(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1)
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  const lastOfMonth = new Date(year, month + 1, 0)
  const gridEnd = new Date(lastOfMonth)
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()))

  const dates: Date[] = []
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    dates.push(cursor)
  }
  return dates
}

/** `getMonthGridDates` chunked into 7-day week rows for the grid's rows. */
export function getMonthGridWeeks(year: number, month: number): Date[][] {
  const dates = getMonthGridDates(year, month)
  const weeks: Date[][] = []
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7))
  }
  return weeks
}
