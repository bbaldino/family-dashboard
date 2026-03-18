import type { CalendarEvent } from '@/integrations/google-calendar/types'
import { DayCell } from './DayCell'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

function dateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function MonthGrid({ year, month, eventsByDate, selectedDate, onDayClick }: MonthGridProps) {
  const dates = getGridDates(year, month)
  const todayKey = dateKey(new Date())

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

      {/* Day grid */}
      <div
        className="grid grid-cols-7 flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${dates.length / 7}, 1fr)` }}
      >
        {dates.map((date) => {
          const key = dateKey(date)
          return (
            <DayCell
              key={key}
              date={date}
              events={eventsByDate[key] ?? []}
              isToday={key === todayKey}
              isCurrentMonth={date.getMonth() === month}
              isSelected={key === selectedDate}
              onClick={() => onDayClick(date, key)}
            />
          )
        })}
      </div>
    </div>
  )
}
