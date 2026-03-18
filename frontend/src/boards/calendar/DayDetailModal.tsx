import { Modal } from '@/ui/Modal'
import type { CalendarEvent } from '@/integrations/google-calendar/types'
import { formatEventTimeFull } from './formatEventTime'

interface DayDetailModalProps {
  date: Date | null
  events: CalendarEvent[]
  onClose: () => void
}

export function DayDetailModal({ date, events, onClose }: DayDetailModalProps) {
  const title = date?.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Modal isOpen={!!date} onClose={onClose} title={title ?? ''}>
      {events.length === 0 ? (
        <div className="text-[13px] text-text-muted py-2">No events</div>
      ) : (
        <div className="space-y-0">
          {events.map((event, i) => (
            <div
              key={event.id + '-' + i}
              className="flex gap-3 py-2.5 border-b border-border last:border-b-0"
            >
              <div
                className="w-1 rounded-full flex-shrink-0 mt-1"
                style={{ background: 'var(--color-calendar)', minHeight: '14px' }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-text-muted">
                  {formatEventTimeFull(event)}
                </div>
                <div className="text-[14px] font-medium text-text-primary">
                  {event.summary ?? '(No title)'}
                </div>
                {event.location && (
                  <div className="text-[11px] text-text-muted mt-0.5 truncate">
                    {event.location}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
