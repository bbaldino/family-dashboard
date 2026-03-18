import type { CalendarEvent } from '@/integrations/google-calendar/types'
import { formatEventTimeCompact } from './formatEventTime'

const MAX_PILLS = 4

interface DayCellProps {
  date: Date
  events: CalendarEvent[] // single-day events only (multi-day rendered by MonthGrid)
  isToday: boolean
  isCurrentMonth: boolean
  isSelected: boolean
  onClick: () => void
  spanSlotHeight: number // px reserved at top for multi-day spanning bars
}

export function DayCell({ date, events, isToday, isCurrentMonth, isSelected, onClick, spanSlotHeight }: DayCellProps) {
  const dayNum = date.getDate()
  const visible = events.slice(0, MAX_PILLS)
  const remaining = events.length - visible.length

  return (
    <div
      className={`flex flex-col border-r border-border overflow-hidden cursor-pointer transition-colors ${
        isSelected ? 'bg-calendar/5' : 'hover:bg-bg-card-hover'
      } ${!isCurrentMonth ? 'opacity-40' : ''}`}
      onClick={onClick}
    >
      {/* Day number */}
      <div className="flex-shrink-0 px-1 pt-1 mb-0.5">
        <span
          className={`inline-flex items-center justify-center text-[12px] font-medium ${
            isToday
              ? 'w-6 h-6 rounded-full bg-calendar text-white'
              : 'text-text-primary'
          }`}
        >
          {dayNum}
        </span>
      </div>

      {/* Space reserved for multi-day spanning bars (rendered by MonthGrid) */}
      {spanSlotHeight > 0 && (
        <div className="flex-shrink-0" style={{ height: `${spanSlotHeight}px` }} />
      )}

      {/* Single-day event pills */}
      {isCurrentMonth && (
        <div className="flex-1 min-h-0 flex flex-col gap-[3px] overflow-hidden px-1 pb-1">
          {visible.map((event, i) => {
            const time = formatEventTimeCompact(event)
            const isAllDay = !event.start.dateTime
            // Timed events use a deeper teal, all-day single-day events use info blue
            const pillBg = isAllDay
              ? 'color-mix(in srgb, var(--color-info) 15%, transparent)'
              : 'color-mix(in srgb, #2a7a5a 12%, transparent)'
            const pillFg = isAllDay ? 'var(--color-info)' : '#2a7a5a'
            return (
              <div
                key={event.id + '-' + i}
                className="text-[10px] leading-tight truncate rounded px-1.5 py-[2px]"
                style={{
                  background: pillBg,
                  color: pillFg,
                }}
              >
                {time && <span className="font-medium">{time} </span>}
                {event.summary ?? '(No title)'}
              </div>
            )
          })}
          {remaining > 0 && (
            <div className="text-[9px] text-text-muted pl-1">+{remaining} more</div>
          )}
        </div>
      )}
    </div>
  )
}
