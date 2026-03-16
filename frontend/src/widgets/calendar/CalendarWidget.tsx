import type { CalendarEvent } from '@/lib/dashboard-api'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { ErrorDisplay } from '@/ui/ErrorDisplay'
import { WidgetCard } from '@/ui/WidgetCard'
import { CalendarDetail } from './CalendarDetail'

function formatEventTime(event: CalendarEvent): string {
  const start = event.start.dateTime ?? event.start.date
  if (!start) return ''
  if (event.start.date && !event.start.dateTime) return 'All day'
  const date = new Date(start)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function isCurrentEvent(event: CalendarEvent): boolean {
  if (!event.start.dateTime || !event.end.dateTime) return false
  const now = new Date()
  return new Date(event.start.dateTime) <= now && now < new Date(event.end.dateTime)
}

interface CalendarWidgetProps {
  events: CalendarEvent[] | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function CalendarWidget({ events, isLoading, error, refetch }: CalendarWidgetProps) {
  if (isLoading) {
    return (
      <WidgetCard title="Today's Schedule" category="calendar" className="h-full">
        <LoadingSpinner />
      </WidgetCard>
    )
  }

  if (error) {
    return (
      <WidgetCard title="Today's Schedule" category="calendar" className="h-full">
        <ErrorDisplay message={error} onRetry={refetch} />
      </WidgetCard>
    )
  }

  const sortedEvents = [...(events ?? [])].sort((a, b) => {
    const aTime = a.start.dateTime ?? a.start.date ?? ''
    const bTime = b.start.dateTime ?? b.start.date ?? ''
    return aTime.localeCompare(bTime)
  })

  const badge = `${sortedEvents.length} event${sortedEvents.length !== 1 ? 's' : ''}`

  return (
    <WidgetCard
      title="Today's Schedule"
      category="calendar"
      badge={badge}
      detail={<CalendarDetail events={sortedEvents} />}
      className="h-full"
    >
      <div className="flex flex-col gap-[2px]">
        {sortedEvents.length === 0 ? (
          <div className="text-[14px] text-text-muted py-2">No events today</div>
        ) : (
          sortedEvents.map((event) => {
            const current = isCurrentEvent(event)
            return (
              <div
                key={event.id}
                className={`flex items-start gap-2 py-[5px] px-[6px] rounded ${
                  current ? 'bg-[color-mix(in_srgb,var(--color-calendar)_8%,transparent)]' : ''
                }`}
              >
                <span className="text-[13px] font-bold text-calendar whitespace-nowrap min-w-[60px]">
                  {formatEventTime(event)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-text-primary truncate">
                    {event.summary ?? '(No title)'}
                  </div>
                  {event.location && (
                    <div className="text-[11px] text-text-muted truncate">{event.location}</div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </WidgetCard>
  )
}
