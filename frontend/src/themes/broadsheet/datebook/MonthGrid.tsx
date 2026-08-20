import type { EventSpan } from '@/integrations/calendar'
import type { CalendarEvent } from '@/providers/google-calendar'
import { toLocalDateStr } from '@/utils/date'
import { DayCell } from './DayCell'
import { getMonthGridWeeks } from './month-grid-dates'
import { buildSpanSegments } from './month-spans'
import { SpanBanner } from './SpanBanner'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Chips a cell renders before collapsing into "+N more", by how many week rows
 * the displayed month needs — a cell's height, and so its chip budget, varies
 * with row count (see `month-grid-dates.ts`), so a flat cap sized for a roomy
 * month overflows a tighter one.
 *
 * Measured live at 1600x900: a 6-row month's cell is ~106px and safely holds
 * 2 chips beside a "+N more" line — 3 chips plus that line overflowed it by
 * ~4px (`scrollHeight` vs `clientHeight` against `?scenario=packed`'s
 * deliberately six-event day). A 5-row cell is ~129px and holds 4; a 4-row
 * cell ~160px and holds 5. The per-row figures come from one calibrated
 * model — ~18px a chip over ~54px of fixed overhead (the day-number row, the
 * cell padding, and the "+N more" line) — tuned so its 6-row value reproduces
 * the hand-verified 2.
 *
 * `DayCell` absorbs a lone overflow on top of this — one extra event rather
 * than a "+1 more" that would cost the same line — so the count actually shown
 * in full is one higher than each figure here.
 */
function maxEventsForWeekCount(weekCount: number): number {
  if (weekCount >= 6) return 2
  if (weekCount === 5) return 4
  return 5
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
 *
 * **Multi-day events are drawn once, as a banner, not as a chip in every
 * cell.** They arrive in `spans` and are filtered back out of the per-day
 * chips here — `byDate` deliberately still carries them, because the grid
 * theme and the month tally both read it and would otherwise lose the event
 * entirely. Banners live in an absolutely-positioned layer over the cells so
 * a run draws across the cell rules instead of being clipped inside one, and
 * the cells beneath reserve `lanes * LANE_H` of space so nothing collides.
 */
export function MonthGrid({
  year,
  month,
  byDate,
  spans = [],
}: {
  year: number
  month: number
  byDate: Record<string, CalendarEvent[]>
  spans?: EventSpan[]
}) {
  const weeks = getMonthGridWeeks(year, month)
  const todayKey = toLocalDateStr(new Date())
  const maxEvents = maxEventsForWeekCount(weeks.length)
  const { segments, reservedLanesByCell } = buildSpanSegments(spans, weeks)
  // Only the spans that actually made it onto the grid are suppressed from the
  // chips: one clipped away entirely still belongs in its cells as a chip,
  // since no banner will be drawn for it.
  const bannerEventIds = new Set(segments.map((segment) => segment.id))

  return (
    <div className="flex flex-col h-full">
      <div
        className="grid grid-cols-7 flex-shrink-0"
        style={{ borderBottom: '2px solid var(--ink)' }}
      >
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
      <div className="flex-1 min-h-0" style={{ position: 'relative' }}>
        <div
          data-testid="month-grid-weeks"
          className="h-full grid"
          style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}
        >
          {weeks.map((week, weekIndex) => (
            <div
              key={week[0].toISOString()}
              data-testid="month-grid-week"
              className="grid grid-cols-7 min-h-0"
            >
              {week.map((date, dayIndex) => {
                const dateKey = toLocalDateStr(date)
                const dayEvents = (byDate[dateKey] ?? []).filter(
                  (event) => !bannerEventIds.has(event.id),
                )
                const lanes = reservedLanesByCell[weekIndex]?.[dayIndex] ?? 0
                return (
                  <DayCell
                    key={dateKey}
                    date={date}
                    events={dayEvents}
                    isCurrentMonth={date.getMonth() === month && date.getFullYear() === year}
                    isToday={dateKey === todayKey}
                    isFirstCellOfGrid={weekIndex === 0 && dayIndex === 0}
                    isLastColumn={dayIndex === 6}
                    isLastRow={weekIndex === weeks.length - 1}
                    maxEvents={maxEvents}
                    lanes={lanes}
                  />
                )
              })}
            </div>
          ))}
        </div>
        {/* Over the cells, not inside them: a banner has to cross the cell
            rules, and `pointerEvents: none` keeps the layer from swallowing
            anything the cells beneath might want. */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {segments.map((segment, i) => (
            <SpanBanner
              key={`${segment.id}-${segment.row}-${i}`}
              segment={segment}
              rowCount={weeks.length}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
