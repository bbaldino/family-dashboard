import { useMemo } from 'react'
import { useGoogleCalendar } from '@/data/google-calendar'
import type { CalendarDay, CalendarEvent } from '@/data/google-calendar'
import { useDrivingTime } from '@/data/driving-time'
import type { EventDriveInfo } from '@/data/driving-time'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { Hairline } from '@/themes/broadsheet/ui/Hairline'
import { formatEventTime } from './event-format'

const proseStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 13,
  color: 'var(--ink-muted)',
}

/** A single event: time at left, title + location, drive time as a rust suffix. */
function EventRow({ event, driveText }: { event: CalendarEvent; driveText?: string }) {
  return (
    <div className="grid items-baseline gap-3 py-2" style={{ gridTemplateColumns: '64px 1fr' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' }}>
        {formatEventTime(event)}
      </div>
      <div className="min-w-0">
        <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink)' }}>
          {event.summary || 'Untitled'}
        </div>
        {(event.location || driveText) && (
          <div className="flex items-baseline gap-2 mt-0.5">
            {event.location && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--ink-muted)' }}>
                {event.location}
              </span>
            )}
            {driveText && (
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rust)', letterSpacing: '0.06em' }}
              >
                {driveText}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** One day: mono kicker with the label, a hairline, then events — or prose when the day is clear. */
function DayGroup({ day, driveInfo }: { day: CalendarDay; driveInfo: Record<string, EventDriveInfo> }) {
  const events = day.events ?? []
  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between">
        <Kicker>{day.label}</Kicker>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}>
          {events.length} {events.length === 1 ? 'event' : 'events'}
        </span>
      </div>
      <Hairline className="mt-1" />
      {events.length > 0 ? (
        <div>
          {events.map((event) => (
            <EventRow key={event.id} event={event} driveText={driveInfo[event.id]?.displayText} />
          ))}
        </div>
      ) : (
        <p className="m-0 py-2" style={proseStyle}>
          Nothing on the books — the day is clear.
        </p>
      )}
    </div>
  )
}

/**
 * The left column of the Home screen: the week's calendar, grouped by day.
 * Every hook can boot with no data on a cold cache — guard `days` throughout,
 * and an empty day gets a written line rather than a gap.
 */
export function ScheduleColumn() {
  const { data: days, isLoading } = useGoogleCalendar()

  const allEvents = useMemo(() => (days ?? []).flatMap((d) => d.events ?? []), [days])
  const driveInfo = useDrivingTime(allEvents)

  return (
    <div>
      <Kicker>Schedule</Kicker>
      <Hairline className="mt-1" />
      {days && days.length > 0 ? (
        days.map((day) => <DayGroup key={day.label} day={day} driveInfo={driveInfo} />)
      ) : (
        <p className="m-0 py-2" style={proseStyle}>
          {isLoading ? 'Fetching the week ahead…' : 'Nothing on the books this week.'}
        </p>
      )}
    </div>
  )
}
