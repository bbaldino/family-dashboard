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
 * How many days this column ever renders, regardless of how many the
 * calendar hook returns (it returns a full week). This is a fixed-canvas
 * page with no scrolling: a day heading, rule, and "nothing on the books"
 * line cost real vertical space even when the day is empty, and a typical
 * week of mostly-empty days was tall enough to overflow the column's
 * budget and print over the glance strip below it. Four complete days
 * (today plus the next three — `days` already arrives sorted starting
 * from today) reads as intentional; clipping mid-week never does. The
 * parent also clips defensively (`overflow-hidden`) in case a day this
 * short still runs long, but that's the safety net, not the plan.
 */
const MAX_VISIBLE_DAYS = 4

/**
 * The left column of the Home screen: the week's calendar, grouped by day.
 * Every hook can boot with no data on a cold cache — guard `days` throughout,
 * and an empty day gets a written line rather than a gap.
 */
export function ScheduleColumn() {
  const { data: days, isLoading } = useGoogleCalendar()
  const visibleDays = useMemo(() => (days ?? []).slice(0, MAX_VISIBLE_DAYS), [days])

  const allEvents = useMemo(() => visibleDays.flatMap((d) => d.events ?? []), [visibleDays])
  const driveInfo = useDrivingTime(allEvents)

  return (
    <div>
      <Kicker>Schedule</Kicker>
      <Hairline className="mt-1" />
      {visibleDays.length > 0 ? (
        visibleDays.map((day) => <DayGroup key={day.label} day={day} driveInfo={driveInfo} />)
      ) : (
        <p className="m-0 py-2" style={proseStyle}>
          {isLoading ? 'Fetching the week ahead…' : 'Nothing on the books this week.'}
        </p>
      )}
    </div>
  )
}
