import type { CalendarEvent } from '@/providers/google-calendar'
import { EventPill } from './EventPill'
import { CELL_RULE, TODAY_BG } from './colors'
import { LANE_H } from './month-spans'

const MONTH_ABBR_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short' })

export function DayCell({
  date,
  events,
  isCurrentMonth,
  isToday,
  isFirstCellOfGrid,
  isLastColumn,
  isLastRow,
  maxEvents,
  lanes = 0,
}: {
  date: Date
  events: CalendarEvent[]
  isCurrentMonth: boolean
  /** Whether `date` is the real "today" — computed once by `MonthGrid`
   *  against a single `toLocalDateStr(new Date())`, the same pattern
   *  grid's own `MonthGrid.tsx` uses, rather than every cell computing
   *  `new Date()` itself. */
  isToday: boolean
  /** Whether this is the grid's very first cell — the only leading
   *  adjacent-month cell that can ever be a run's first day (see
   *  `showAdjacentMonthLabel` below). */
  isFirstCellOfGrid: boolean
  isLastColumn: boolean
  isLastRow: boolean
  /** Events this cell ever renders before collapsing into "+N more" — see
   *  `maxEventsForWeekCount` in `MonthGrid.tsx` for how this is derived and
   *  measured per row-count tier. */
  maxEvents: number
  /** Multi-day banner lanes reserved across this cell's whole week. Every
   *  cell in a row gets the same count, including cells no banner crosses, so
   *  the chips stay on one line across the week instead of stepping up and
   *  down under the banners. */
  lanes?: number
}) {
  const dayNum = date.getDate()
  const isWeekend = date.getDay() === 0 || date.getDay() === 6

  // The mock labels the first visible day of an adjacent month with a mono
  // month abbreviation (`calendar.jsx:305-310`: "JUN" beside June 1st on the
  // trailing side, "APR" beside the leading run's first cell). Genuinely
  // "day 1 of the month" only ever lands in the grid on the trailing side —
  // the leading side shows an adjacent month's last few days, never its
  // day 1 — so the two mock conditions collapse into one general rule here:
  // a cell starts a new adjacent-month run when it's that month's day 1, or
  // when it's the very first cell in the whole grid (the only way a
  // leading run's start can appear without being day 1).
  const showAdjacentMonthLabel = !isCurrentMonth && (dayNum === 1 || isFirstCellOfGrid)

  // Every banner lane costs this cell a chip: the lanes sit in the same
  // vertical space the chips would have used, so the cap comes down with them
  // rather than the chips being pushed out of the cell's bottom. `max(0, …)`
  // because a week can carry more banner lanes than a cell has chip slots.
  const visibleCap = Math.max(0, maxEvents - lanes)
  // Absorb a lone overflow: rendering one more event costs the same single
  // line the "+1 more" would, so never collapse exactly one — the reader gets
  // the event instead of a count they can't act on. Past that, cap and
  // summarise the rest.
  const visible = events.length <= visibleCap + 1 ? events : events.slice(0, visibleCap)
  const hiddenCount = events.length - visible.length

  return (
    <div
      style={{
        borderRight: isLastColumn ? 'none' : `1px solid ${CELL_RULE}`,
        borderBottom: isLastRow ? 'none' : `1px solid ${CELL_RULE}`,
        padding: '4px 6px',
        background: isToday ? TODAY_BG : 'transparent',
        opacity: isCurrentMonth ? 1 : 0.42,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div className="flex items-baseline" style={{ gap: 6, marginBottom: 3 }}>
        {isToday ? (
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: 22,
              height: 22,
              borderRadius: 22,
              background: 'var(--rust)',
              color: 'var(--paper)',
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {dayNum}
          </span>
        ) : (
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 600,
              color: !isCurrentMonth
                ? 'var(--ink-muted)'
                : isWeekend
                  ? 'var(--rust)'
                  : 'var(--ink)',
            }}
          >
            {dayNum}
          </span>
        )}
        {showAdjacentMonthLabel && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--ink-muted)',
              letterSpacing: '0.1em',
            }}
          >
            {MONTH_ABBR_FORMAT.format(date).toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex flex-col" style={{ paddingTop: lanes * LANE_H }}>
        {visible.map((event, i) => (
          <EventPill key={event.id + '-' + i} event={event} />
        ))}
        {/* Only when something is actually shown above it: a bare "+N more" on
            a cell with no visible pill (which happens when banner lanes consume
            the whole chip budget) reads as an empty day that inexplicably
            claims hidden events. Suppress it — the banners crossing the row
            already say the day is busy. */}
        {hiddenCount > 0 && visible.length > 0 && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontStyle: 'italic',
              color: 'var(--ink-muted)',
              padding: '1px 6px',
            }}
          >
            +{hiddenCount} more
          </div>
        )}
      </div>
    </div>
  )
}
