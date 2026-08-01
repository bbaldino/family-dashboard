/**
 * Pure month arithmetic for the Datebook's navigation — the screen owns
 * `year`/`month` state (there is no route parameter for a month, per the
 * brief), and these helpers compute what "previous"/"next" and display
 * labels mean without touching that state directly, so they're trivial to
 * unit test.
 */

/** `{ year, month }` shifted by `delta` months (negative goes back). Lets
 *  `Date`'s own month-overflow arithmetic handle year rollover, rather than
 *  hand-rolling the December→January / January→December edge cases. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const shifted = new Date(year, month + delta, 1)
  return { year: shifted.getFullYear(), month: shifted.getMonth() }
}

const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

/** "May 2026" for the given `year`/`month` (0-indexed, JS `Date` convention). */
export function formatMonthYear(year: number, month: number): string {
  return MONTH_YEAR_FORMAT.format(new Date(year, month, 1))
}
