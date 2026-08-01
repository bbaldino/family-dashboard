import type { CalendarEvent } from '@/data/google-calendar'
import { toLocalDateStr } from '@/utils/date'
import { DayCell } from './DayCell'
import { getMonthGridWeeks } from './month-grid-dates'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Events a cell ever renders before collapsing into "+N more", by how many
 * week rows the currently displayed month needs.
 *
 * The design mock caps at a flat 5 (`calendar.jsx:313`), but that number
 * comes from a fixed 6-row grid at the mock's own May 2026 example — this
 * grid's row count actually varies month to month (see
 * `month-grid-dates.ts`'s header comment), so a cell's real height varies
 * too, and a flat cap sized for a roomy month overflows a tighter one.
 * Verified live at 1600x900 against `?scenario=packed` (which deliberately
 * puts six events on one day, specifically to exercise this cap): a 6-row
 * month's cell is ~104px tall, and 5 pills plus the "+N more" line need
 * ~151px regardless of the cell — a flat cap of 5 overflows a 6-row
 * month's cell by ~47px. Each tier below was independently verified live
 * (measuring `scrollHeight` vs `clientHeight` against the same
 * six-event day, navigated to a month with that many rows) rather than
 * computed from cell height alone — the header row and "+N more" line's
 * own height don't scale with the cell, so the safe cap isn't a simple
 * ratio of the flat cap against row count.
 */
function maxEventsForWeekCount(weekCount: number): number {
  if (weekCount >= 6) return 2
  if (weekCount === 5) return 3
  return 4
}

/**
 * The month body: a weekday header closed by a solid rule, then day cells
 * filling the remaining height — `repeat(weeks.length, 1fr)` rather than a
 * hardcoded six rows, since not every month needs six (see
 * `month-grid-dates.ts`'s header comment). `byDate` is
 * `MonthEvents['byDate']` straight from `useMonthCalendar` — already keyed
 * by "YYYY-MM-DD" with multi-day events expanded across every day they
 * span and each day's events pre-sorted all-day first then chronological,
 * so this component does no event shaping of its own, only lookup and the
 * per-cell display cap.
 */
export function MonthGrid({
  year,
  month,
  byDate,
}: {
  year: number
  month: number
  byDate: Record<string, CalendarEvent[]>
}) {
  const weeks = getMonthGridWeeks(year, month)
  const todayKey = toLocalDateStr(new Date())
  const maxEvents = maxEventsForWeekCount(weeks.length)

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 flex-shrink-0" style={{ borderBottom: '2px solid var(--ink)' }}>
        {WEEKDAYS.map((label, i) => (
          <div
            key={label}
            className="uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.22em',
              fontWeight: 700,
              padding: '6px 8px',
              textAlign: 'left',
              color: i === 0 || i === 6 ? 'var(--rust)' : 'var(--ink-muted)',
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div data-testid="month-grid-weeks" className="flex-1 min-h-0 grid" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, weekIndex) => (
          <div key={week[0].toISOString()} data-testid="month-grid-week" className="grid grid-cols-7 min-h-0">
            {week.map((date, dayIndex) => {
              const dateKey = toLocalDateStr(date)
              return (
                <DayCell
                  key={dateKey}
                  date={date}
                  events={byDate[dateKey] ?? []}
                  isCurrentMonth={date.getMonth() === month && date.getFullYear() === year}
                  isToday={dateKey === todayKey}
                  isFirstCellOfGrid={weekIndex === 0 && dayIndex === 0}
                  isLastColumn={dayIndex === 6}
                  isLastRow={weekIndex === weeks.length - 1}
                  maxEvents={maxEvents}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
