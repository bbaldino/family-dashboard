import type { CalendarEvent } from './types'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { ErrorDisplay } from '@/ui/ErrorDisplay'
import { WidgetCard } from '@/ui/WidgetCard'
import type { CalendarDay } from './useGoogleCalendar'
import { useDrivingTime, DriveTag } from '@/integrations/driving-time'

function formatEventTime(event: CalendarEvent): string {
  const start = event.start.dateTime ?? event.start.date
  if (!start) return ''
  if (event.start.date && !event.start.dateTime) return 'All day'
  const startStr = new Date(start).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
  if (event.end.dateTime) {
    const endStr = new Date(event.end.dateTime).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
    return `${startStr} – ${endStr}`
  }
  return startStr
}

function isCurrentEvent(event: CalendarEvent): boolean {
  if (!event.start.dateTime || !event.end.dateTime) return false
  const now = new Date()
  return (
    new Date(event.start.dateTime) <= now && now < new Date(event.end.dateTime)
  )
}

interface CalendarWidgetProps {
  days: CalendarDay[] | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function CalendarWidget({
  days,
  isLoading,
  error,
  refetch,
}: CalendarWidgetProps) {
  const allEvents = (days ?? []).flatMap((d) => d.events)
  const driveInfo = useDrivingTime(allEvents)

  if (isLoading) {
    return (
      <WidgetCard title="Schedule" category="calendar" className="h-full">
        <LoadingSpinner />
      </WidgetCard>
    )
  }

  if (error) {
    return (
      <WidgetCard title="Schedule" category="calendar" className="h-full">
        <ErrorDisplay message={error} onRetry={refetch} />
      </WidgetCard>
    )
  }

  const allDays = days ?? []
  const totalEvents = allDays.reduce((sum, d) => sum + d.events.length, 0)
  const badge = `${totalEvents} event${totalEvents !== 1 ? 's' : ''}`

  // Show days that have events, plus always show today
  const visibleDays = allDays.filter((d) => d.isToday || d.events.length > 0)

  return (
    <WidgetCard title="Schedule" category="calendar" badge={badge} className="h-full">
      <div className="flex flex-col gap-[8px] overflow-auto">
        {visibleDays.length === 0 ? (
          <div className="text-[14px] text-text-muted py-2">
            No events this week
          </div>
        ) : (
          visibleDays.map((day) => (
            <div key={day.label}>
              <div
                className={`text-[11px] font-bold uppercase tracking-[0.5px] mb-[3px] ${
                  day.isToday ? 'text-palette-1' : 'text-text-secondary'
                }`}
              >
                {day.label}
              </div>
              {day.events.length === 0 ? (
                <div className="text-[13px] text-text-muted pl-1">
                  No events
                </div>
              ) : (
                <div className="flex flex-col gap-[1px]">
                  {day.events.map((event) => {
                    const current = day.isToday && isCurrentEvent(event)
                    return (
                      <div
                        key={event.id}
                        className={`flex items-start gap-2 py-[4px] px-[6px] rounded ${
                          current
                            ? 'bg-[color-mix(in_srgb,var(--color-palette-1)_8%,transparent)]'
                            : ''
                        }`}
                      >
                        <span className="text-[12px] font-semibold text-palette-1 whitespace-nowrap">
                          {formatEventTime(event)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-text-primary truncate">
                            {event.summary ?? '(No title)'}
                          </div>
                          {event.location && (
                            <div className="text-[11px] text-text-muted truncate">
                              {event.location}
                            </div>
                          )}
                          {driveInfo[event.id] && (
                            <div className="mt-0.5">
                              <DriveTag
                                displayText={driveInfo[event.id].displayText}
                                urgency={driveInfo[event.id].urgency}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </WidgetCard>
  )
}
