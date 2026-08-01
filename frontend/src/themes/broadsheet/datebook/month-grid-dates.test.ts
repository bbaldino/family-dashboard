import { describe, expect, it } from 'vitest'
import { getMonthGridDates, getMonthGridWeeks } from './month-grid-dates'

describe('getMonthGridDates', () => {
  it('spans Sunday through the closing Saturday, six weeks, for a month that needs six', () => {
    // May 2026 starts on a Friday and ends on a Sunday — the design mock's
    // own example month, which needs the full six rows.
    const dates = getMonthGridDates(2026, 4)
    expect(dates).toHaveLength(42)
    expect(dates[0].toDateString()).toBe(new Date(2026, 3, 26).toDateString())
    expect(dates[41].toDateString()).toBe(new Date(2026, 5, 6).toDateString())
  })

  it('spans only four weeks for a month that fits exactly', () => {
    // February 2026 starts on a Sunday and has 28 days — exactly four weeks,
    // no overflow padding on either side.
    const dates = getMonthGridDates(2026, 1)
    expect(dates).toHaveLength(28)
    expect(dates[0].toDateString()).toBe(new Date(2026, 1, 1).toDateString())
    expect(dates[27].toDateString()).toBe(new Date(2026, 1, 28).toDateString())
  })

  it('never returns more days than useMonthCalendar itself fetches', () => {
    // Regression guard for the reasoning in this module's header comment:
    // a grid that renders more weeks than the data hook fetched would show
    // cells whose events were never requested. Recomputes the hook's own
    // gridStart/gridEnd range (its fetch bound is exclusive) and checks the
    // day count matches exactly, for a spread of months with different
    // week counts.
    for (const [year, month] of [
      [2026, 4], // 6 weeks
      [2026, 1], // 4 weeks
      [2026, 0], // 5 weeks
    ] as const) {
      const firstOfMonth = new Date(year, month, 1)
      const gridStart = new Date(firstOfMonth)
      gridStart.setDate(gridStart.getDate() - gridStart.getDay())
      const lastOfMonth = new Date(year, month + 1, 0)
      const fetchGridEnd = new Date(lastOfMonth)
      fetchGridEnd.setDate(fetchGridEnd.getDate() + (6 - fetchGridEnd.getDay()) + 1)
      const fetchedDayCount = Math.round((fetchGridEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24))

      expect(getMonthGridDates(year, month)).toHaveLength(fetchedDayCount)
    }
  })
})

describe('getMonthGridWeeks', () => {
  it('chunks the dates into 7-day week rows', () => {
    const weeks = getMonthGridWeeks(2026, 4)
    expect(weeks).toHaveLength(6)
    for (const week of weeks) expect(week).toHaveLength(7)
  })

  it('chunks a four-week month into exactly four rows', () => {
    expect(getMonthGridWeeks(2026, 1)).toHaveLength(4)
  })
})
