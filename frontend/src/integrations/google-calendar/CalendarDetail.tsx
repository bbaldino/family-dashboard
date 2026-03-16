import type { CalendarEvent } from './types'

function formatEventTime(event: CalendarEvent): string {
  const start = event.start.dateTime ?? event.start.date
  if (!start) return ''
  if (event.start.date && !event.start.dateTime) return 'All day'
  const date = new Date(start)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatEndTime(event: CalendarEvent): string {
  const end = event.end.dateTime ?? event.end.date
  if (!end || !event.end.dateTime) return ''
  return new Date(end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

interface CalendarDetailProps {
  events: CalendarEvent[]
}

export function CalendarDetail({ events }: CalendarDetailProps) {
  return (
    <div>
      <h2 className="text-[18px] font-semibold text-text-primary mb-4">Today&apos;s Schedule</h2>
      {events.length === 0 ? (
        <div className="text-[14px] text-text-muted py-4">No events today</div>
      ) : (
        <div className="flex flex-col gap-1">
          {events.map((event) => {
            const time = formatEventTime(event)
            const endTime = formatEndTime(event)
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 py-3 border-b border-border last:border-0"
              >
                <div className="min-w-[80px]">
                  <div className="text-[14px] font-bold text-calendar">{time}</div>
                  {endTime && (
                    <div className="text-[11px] text-text-muted">to {endTime}</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-medium text-text-primary">
                    {event.summary ?? '(No title)'}
                  </div>
                  {event.location && (
                    <div className="text-[12px] text-text-muted mt-[2px]">{event.location}</div>
                  )}
                  {event.description && (
                    <div className="text-[12px] text-text-secondary mt-1 line-clamp-2">
                      {event.description}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
