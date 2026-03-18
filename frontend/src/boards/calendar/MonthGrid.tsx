import type { CalendarEvent } from '@/integrations/google-calendar/types'
import { DayCell } from './DayCell'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SPAN_BAR_HEIGHT = 18 // px per spanning event bar
const SPAN_BAR_GAP = 2

interface MonthGridProps {
  year: number
  month: number
  eventsByDate: Record<string, CalendarEvent[]>
  selectedDate: string | null
  onDayClick: (date: Date, dateKey: string) => void
}

function getGridDates(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)

  const start = new Date(firstOfMonth)
  start.setDate(start.getDate() - start.getDay())

  const end = new Date(lastOfMonth)
  end.setDate(end.getDate() + (6 - end.getDay()))

  const dates: Date[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** A multi-day event span within a single week row */
interface SpanBar {
  event: CalendarEvent
  startCol: number // 0-6
  endCol: number   // 0-6 (inclusive)
  lane: number     // vertical slot (0, 1, 2...)
  continuesFromPrev: boolean
  continuesToNext: boolean
}

/** Check if an event is multi-day (all-day spanning 2+ days) */
function isMultiDay(event: CalendarEvent): boolean {
  if (event.start.dateTime) return false // timed events aren't shown as spans
  const startKey = (event.start.date ?? '').substring(0, 10)
  const endKey = (event.end.date ?? '').substring(0, 10)
  return startKey !== endKey && !!startKey && !!endKey
}

/** Compute spanning bars for a single week row */
function computeSpanBars(weekDates: Date[], eventsByDate: Record<string, CalendarEvent[]>): SpanBar[] {
  const weekStart = toDateKey(weekDates[0])
  const weekEndDate = new Date(weekDates[6])
  weekEndDate.setDate(weekEndDate.getDate() + 1)
  const weekEnd = toDateKey(weekEndDate)

  // Find all multi-day events that overlap this week
  const seen = new Set<string>()
  const multiDayEvents: { event: CalendarEvent; eventStart: string; eventEnd: string }[] = []

  for (const date of weekDates) {
    const key = toDateKey(date)
    const events = eventsByDate[key] ?? []
    for (const event of events) {
      if (isMultiDay(event) && !seen.has(event.id)) {
        seen.add(event.id)
        multiDayEvents.push({
          event,
          eventStart: (event.start.date ?? '').substring(0, 10),
          eventEnd: (event.end.date ?? '').substring(0, 10),
        })
      }
    }
  }

  // Sort by start date, then by duration (longer first)
  multiDayEvents.sort((a, b) => {
    const cmp = a.eventStart.localeCompare(b.eventStart)
    if (cmp !== 0) return cmp
    return b.eventEnd.localeCompare(a.eventEnd) // longer first
  })

  // Assign lanes (greedy)
  const bars: SpanBar[] = []
  const laneEnds: number[] = [] // tracks where each lane is free (column index)

  for (const { event, eventStart, eventEnd } of multiDayEvents) {
    // Clamp to this week's boundaries
    const clampedStart = eventStart < weekStart ? weekStart : eventStart
    const clampedEnd = eventEnd > weekEnd ? weekEnd : eventEnd

    const startCol = weekDates.findIndex((d) => toDateKey(d) === clampedStart)
    let endCol = weekDates.findIndex((d) => toDateKey(d) === clampedEnd)

    // endCol is exclusive (end date in Google Calendar is day after last day)
    // So the bar ends on the day before
    if (endCol === -1) {
      endCol = 6 // extends beyond this week
    } else {
      endCol = endCol - 1
    }

    if (startCol === -1 || endCol < startCol) continue

    // Find a lane
    let lane = 0
    while (lane < laneEnds.length && laneEnds[lane] > startCol) {
      lane++
    }
    if (lane >= laneEnds.length) {
      laneEnds.push(0)
    }
    laneEnds[lane] = endCol + 1

    bars.push({
      event,
      startCol,
      endCol,
      lane,
      continuesFromPrev: eventStart < weekStart,
      continuesToNext: eventEnd > weekEnd,
    })
  }

  return bars
}

/** Get single-day events for a date (excluding multi-day) */
function getSingleDayEvents(dateKey: string, eventsByDate: Record<string, CalendarEvent[]>): CalendarEvent[] {
  const events = eventsByDate[dateKey] ?? []
  return events.filter((e) => !isMultiDay(e))
}

export function MonthGrid({ year, month, eventsByDate, selectedDate, onDayClick }: MonthGridProps) {
  const dates = getGridDates(year, month)
  const todayKey = toDateKey(new Date())
  const weeks: Date[][] = []
  for (let i = 0; i < dates.length; i += 7) {
    weeks.push(dates.slice(i, i + 7))
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border flex-shrink-0">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-semibold text-text-muted uppercase py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Week rows */}
      <div className="flex-1 min-h-0 flex flex-col">
        {weeks.map((weekDates, weekIdx) => {
          const spanBars = computeSpanBars(weekDates, eventsByDate)
          const maxLane = spanBars.length > 0 ? Math.max(...spanBars.map((b) => b.lane)) + 1 : 0
          const spanHeight = maxLane * (SPAN_BAR_HEIGHT + SPAN_BAR_GAP)

          return (
            <div key={weekIdx} className="flex-1 min-h-0 relative border-b border-border last:border-b-0">
              {/* 7-column grid for day cells */}
              <div className="grid grid-cols-7 h-full">
                {weekDates.map((date) => {
                  const key = toDateKey(date)
                  return (
                    <DayCell
                      key={key}
                      date={date}
                      events={getSingleDayEvents(key, eventsByDate)}
                      isToday={key === todayKey}
                      isCurrentMonth={date.getMonth() === month}
                      isSelected={key === selectedDate}
                      onClick={() => onDayClick(date, key)}
                      spanSlotHeight={spanHeight}
                    />
                  )
                })}
              </div>

              {/* Spanning multi-day bars overlaid on top */}
              {spanBars.map((bar) => {
                const left = `${(bar.startCol / 7) * 100}%`
                const width = `${((bar.endCol - bar.startCol + 1) / 7) * 100}%`
                // Position below the day number row
                const top = 24 + bar.lane * (SPAN_BAR_HEIGHT + SPAN_BAR_GAP)

                return (
                  <div
                    key={`${bar.event.id}-${weekIdx}`}
                    className="absolute text-[10px] leading-tight truncate font-medium pointer-events-none"
                    style={{
                      left,
                      width,
                      top: `${top}px`,
                      height: `${SPAN_BAR_HEIGHT}px`,
                      paddingLeft: bar.continuesFromPrev ? '4px' : '8px',
                      paddingRight: bar.continuesToNext ? '4px' : '8px',
                      display: 'flex',
                      alignItems: 'center',
                      background: 'color-mix(in srgb, var(--color-info) 20%, transparent)',
                      color: 'var(--color-info)',
                      borderRadius: `${bar.continuesFromPrev ? '0' : '4px'} ${bar.continuesToNext ? '0' : '4px'} ${bar.continuesToNext ? '0' : '4px'} ${bar.continuesFromPrev ? '0' : '4px'}`,
                      marginLeft: bar.continuesFromPrev ? '0' : '4px',
                      marginRight: bar.continuesToNext ? '0' : '4px',
                    }}
                  >
                    {!bar.continuesFromPrev && (bar.event.summary ?? '(No title)')}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
