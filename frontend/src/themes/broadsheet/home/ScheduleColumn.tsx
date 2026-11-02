import { useMemo } from 'react'
import { useGoogleCalendar } from '@/integrations/calendar'
import type { CalendarDay } from '@/integrations/calendar'
import { useDrivingTime } from '@/integrations/driving-time'
import type { EventDriveInfo } from '@/integrations/driving-time'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { formatEventTime } from './event-format'
import { allDayLine, splitTodayDocket } from './today-docket'
import { useNow } from './useNow'
import { TodayDocket } from './TodayDocket'

const TODAY_KICKER_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const WEEK_DAY_ABBR = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const WEEK_DAY_DATE = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' })

/** The lead block: today's date, headline, and today's events — all-day ones
 *  in a line under the headline, timed ones in a list that scrolls with the
 *  clock (`TodayDocket`) — or a written blank-docket line. Mock:
 *  `broadsheet-v2.jsx:146-188`. */
function TodayHero({
  today,
  driveInfo,
}: {
  today: CalendarDay | undefined
  driveInfo: Record<string, EventDriveInfo>
}) {
  const now = useNow()
  const allEvents = today?.events ?? []
  const { allDay, earlier, ahead } = splitTodayDocket(allEvents, now)

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 4 }}>
        <Kicker>Today{today ? ` · ${TODAY_KICKER_DATE.format(today.date)}` : ''}</Kicker>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--ink-muted)',
            letterSpacing: '0.12em',
          }}
        >
          {allEvents.length} {allEvents.length === 1 ? 'event' : 'events'}
        </span>
      </div>
      <h2
        className="m-0"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 38,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          lineHeight: 0.95,
          marginBottom: 12,
        }}
      >
        What&apos;s on <span style={{ fontStyle: 'italic', color: 'var(--rust)' }}>today.</span>
      </h2>
      {allDay.length > 0 && (
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            paddingBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--rust)',
              marginRight: 8,
            }}
          >
            ALL DAY
          </span>
          {allDayLine(allDay)}
        </div>
      )}
      {earlier.length > 0 || ahead.length > 0 ? (
        <TodayDocket earlier={earlier} ahead={ahead} now={now} driveInfo={driveInfo} />
      ) : allDay.length > 0 ? (
        <div style={{ padding: '14px 0', borderTop: '2px solid var(--ink)' }}>
          <p
            className="m-0"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 16,
              color: 'var(--ink-muted)',
              lineHeight: 1.4,
            }}
          >
            — the rest of the day is clear —
          </p>
        </div>
      ) : (
        <div style={{ padding: '14px 0', borderTop: '2px solid var(--ink)' }}>
          <p
            className="m-0"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 16,
              color: 'var(--ink-muted)',
              lineHeight: 1.4,
            }}
          >
            — a rare blank docket —
          </p>
          <p
            className="m-0"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 13,
              color: 'var(--ink-muted)',
            }}
          >
            the house has nothing pencilled in.
          </p>
        </div>
      )}
    </div>
  )
}

/** One day in the week-ahead strip: a compact day label and up to
 *  `maxEvents` lines. Mock: `broadsheet-v2.jsx:194-209`. */
function WeekAheadDay({
  day,
  maxEvents,
  first,
}: {
  day: CalendarDay
  maxEvents: number
  first: boolean
}) {
  const events = day.events ?? []
  const visible = events.slice(0, maxEvents)
  const hidden = events.length - visible.length

  return (
    <div
      className="grid gap-2.5"
      style={{
        gridTemplateColumns: '60px 1fr',
        padding: '4px 0',
        borderTop: first ? 'none' : '1px dotted var(--rule)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.14em',
          color: 'var(--ink-muted)',
          paddingTop: 3,
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>
          {WEEK_DAY_ABBR.format(day.date)}
        </span>{' '}
        {WEEK_DAY_DATE.format(day.date)}
      </div>
      <div className="min-w-0">
        {events.length === 0 ? (
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--ink-muted)',
            }}
          >
            —
          </span>
        ) : (
          visible.map((event) => (
            <div
              key={event.id}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                lineHeight: 1.3,
                color: 'var(--ink)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--ink-muted)',
                  marginRight: 6,
                }}
              >
                {formatEventTime(event)}
              </span>
              {event.summary || 'Untitled'}
            </div>
          ))
        )}
        {hidden > 0 && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontStyle: 'italic',
              color: 'var(--ink-muted)',
              marginTop: 1,
            }}
          >
            +{hidden} more
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * How many days after today the week-ahead strip shows, and how many
 * events each of those days ever renders — separate budgets, per the
 * design brief. `useGoogleCalendar()` always returns a full week (today
 * plus six more); `MAX_VISIBLE_DAYS` used to be the single knob capping
 * *both* how many days rendered and (implicitly, by rendering every event)
 * how tall each one ran, because the old layout gave every day the same
 * full treatment — heading, hairline, and an uncapped event list. Seven of
 * those overflowed the column.
 *
 * The new layout splits the two concerns instead: the Today hero is one
 * day, always fully detailed, sized on its own. The week-ahead strip below
 * it is a single compact row per day (mock: `broadsheet-v2.jsx:194`), so
 * its per-day cost is now bounded by the event cap rather than by how much
 * the calendar happens to return — which is what makes it safe to show
 * more days than the old design could. `MAX_WEEK_AHEAD_DAYS` matches the
 * mock's `d.schedule.slice(1, 6)` (5 days).
 *
 * `MAX_WEEK_AHEAD_EVENTS` is 3 (2 while a game is live and narrows this
 * column — `Home`'s `BODY_COLUMNS_LIVE`). The mock caps at 2/1, but at those
 * numbers real weeks left ~130px of the fixed-height column empty below the
 * last day while events hid behind "+N more". 3/2 reclaims that space;
 * verified live at 1600x900 against `?scenario=packed` that the column still
 * clears the body's bottom edge (the strip is a single compact line per day,
 * so five days at three lines each stays well inside the height the hero
 * leaves it).
 */
const MAX_WEEK_AHEAD_DAYS = 5
const MAX_WEEK_AHEAD_EVENTS = 3
const MAX_WEEK_AHEAD_EVENTS_LIVE = 2

const proseStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 13,
  color: 'var(--ink-muted)',
}

/**
 * The left column of the Home screen: today gets the hero treatment — a
 * headline and its full event list — and the rest of the week collapses
 * into a compact, muted strip beneath a double rule. Every hook can boot
 * with no data on a cold cache — guard `days` throughout, and an empty day
 * (today or otherwise) gets a written line rather than a gap.
 *
 * `isLive` narrows the week-ahead per-day event cap to match the sports
 * column blooming into a wider slot (`Home`'s `BODY_COLUMNS_LIVE`) — this
 * column has less room while a game is live, so each day shows one line
 * instead of two.
 */
export function ScheduleColumn({ isLive = false }: { isLive?: boolean }) {
  const { data: days, isLoading } = useGoogleCalendar()

  const today = days?.[0]
  const weekAhead = useMemo(() => (days ?? []).slice(1, 1 + MAX_WEEK_AHEAD_DAYS), [days])
  const maxWeekAheadEvents = isLive ? MAX_WEEK_AHEAD_EVENTS_LIVE : MAX_WEEK_AHEAD_EVENTS

  const allEvents = useMemo(() => {
    const todayEvents = today?.events ?? []
    const weekEvents = weekAhead.flatMap((d) => d.events ?? [])
    return [...todayEvents, ...weekEvents]
  }, [today, weekAhead])
  const driveInfo = useDrivingTime(allEvents)

  if (!days || days.length === 0) {
    return (
      <p className="m-0 py-2" style={proseStyle}>
        {isLoading ? 'Fetching the week ahead…' : 'Nothing on the books this week.'}
      </p>
    )
  }

  return (
    <div>
      <TodayHero today={today} driveInfo={driveInfo} />
      {weekAhead.length > 0 && (
        <div style={{ marginTop: 18, paddingTop: 12, borderTop: '3px double var(--ink)' }}>
          <Kicker color="var(--ink-muted)">The week ahead</Kicker>
          <div className="mt-2 flex flex-col">
            {weekAhead.map((day, i) => (
              <WeekAheadDay
                key={day.label}
                day={day}
                maxEvents={maxWeekAheadEvents}
                first={i === 0}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
