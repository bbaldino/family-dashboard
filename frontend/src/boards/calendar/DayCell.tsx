import type { CalendarEvent } from '@/integrations/google-calendar/types'
import { formatEventTimeCompact } from './formatEventTime'

const MAX_PILLS = 3

interface DayCellProps {
  date: Date
  events: CalendarEvent[]
  isToday: boolean
  isCurrentMonth: boolean
  isSelected: boolean
  onClick: () => void
}

export function DayCell({ date, events, isToday, isCurrentMonth, isSelected, onClick }: DayCellProps) {
  const dayNum = date.getDate()
  const visible = events.slice(0, MAX_PILLS)
  const remaining = events.length - visible.length

  return (
    <div
      className={`flex flex-col p-1 border-b border-r border-border overflow-hidden cursor-pointer transition-colors ${
        isSelected ? 'bg-calendar/5' : 'hover:bg-bg-card-hover'
      } ${!isCurrentMonth ? 'opacity-40' : ''}`}
      onClick={onClick}
    >
      <div className="flex-shrink-0 mb-0.5">
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

      {isCurrentMonth && (
        <div className="flex-1 min-h-0 flex flex-col gap-[3px] overflow-hidden">
          {visible.map((event, i) => {
            const time = formatEventTimeCompact(event)
            const isAllDay = !event.start.dateTime
            const pillColor = isAllDay ? '--color-info' : '--color-calendar'
            return (
              <div
                key={event.id + '-' + i}
                className="text-[10px] leading-tight truncate rounded px-1.5 py-[2px]"
                style={{
                  background: `color-mix(in srgb, var(${pillColor}) 15%, transparent)`,
                  color: `var(${pillColor})`,
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
