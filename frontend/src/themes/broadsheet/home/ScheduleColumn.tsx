import { useMemo } from 'react'
import { MapPin, Car } from 'lucide-react'
import { useGoogleCalendar } from '@/data/google-calendar'
import type { CalendarDay, CalendarEvent } from '@/data/google-calendar'
import { useDrivingTime } from '@/data/driving-time'
import type { EventDriveInfo } from '@/data/driving-time'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { formatEventTime } from './event-format'

/** A rule lighter than `--rule` (the theme's hairline is full ink) for
 *  dividers that need to recede rather than draw a line — the mock's
 *  `C.ruleSoft`. Computed from the theme's own tokens rather than a new
 *  custom property (see the design brief's guidance on `ruleSoft`/`ink2`/
 *  `accent2`: approximate with what exists unless a token earns its place).
 *  `color-mix` is already how `grid` builds tinted surfaces from its palette
 *  tokens (e.g. `src/themes/grid/ui/WidgetCard.tsx`), so this follows suit. */
const RULE_SOFT = 'color-mix(in srgb, var(--rule) 25%, var(--paper))'

const TODAY_KICKER_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const WEEK_DAY_ABBR = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const WEEK_DAY_DATE = new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric' })

/** One event in the Today hero: time, title + location, drive time. Mock:
 *  `broadsheet-v2.jsx:156-179`. */
function TodayEventRow({ event, driveInfo, first }: { event: CalendarEvent; driveInfo?: EventDriveInfo; first: boolean }) {
  return (
    <div
      className="grid items-baseline gap-3"
      style={{
        gridTemplateColumns: '70px 1fr auto',
        padding: '9px 0',
        borderTop: first ? '2px solid var(--ink)' : `1px solid ${RULE_SOFT}`,
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--ink)' }}>
        {formatEventTime(event)}
      </div>
      <div className="min-w-0">
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600, lineHeight: 1.25, color: 'var(--ink)' }}>
          {event.summary || 'Untitled'}
        </div>
        {event.location && (
          <div className="flex items-center gap-1 mt-0.5" style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--ink-muted)' }}>
            <MapPin size={11} strokeWidth={1.5} />
            {event.location}
          </div>
        )}
      </div>
      {driveInfo && (
        <div className="text-right">
          <div
            className="flex items-center justify-end gap-1"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--rust)', letterSpacing: '0.06em' }}
          >
            <Car size={11} strokeWidth={1.5} />
            {driveInfo.displayText}
          </div>
        </div>
      )}
    </div>
  )
}

/** The lead block: today's date, headline, and every event today — or a
 *  written blank-docket line. Mock: `broadsheet-v2.jsx:146-188`. */
function TodayHero({ today, driveInfo }: { today: CalendarDay | undefined; driveInfo: Record<string, EventDriveInfo> }) {
  const events = today?.events ?? []

  return (
    <div style={{ marginBottom: 14 }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 4 }}>
        <Kicker>Today{today ? ` · ${TODAY_KICKER_DATE.format(today.date)}` : ''}</Kicker>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', letterSpacing: '0.12em' }}>
          {events.length} {events.length === 1 ? 'event' : 'events'}
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
      {events.length > 0 ? (
        <div>
          {events.map((event, i) => (
            <TodayEventRow key={event.id} event={event} driveInfo={driveInfo[event.id]} first={i === 0} />
          ))}
        </div>
      ) : (
        <div style={{ padding: '14px 0', borderTop: '2px solid var(--ink)' }}>
          <p
            className="m-0"
            style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink-muted)', lineHeight: 1.4 }}
          >
            — a rare blank docket —
          </p>
          <p className="m-0" style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 13, color: 'var(--ink-muted)' }}>
            the house has nothing pencilled in.
          </p>
        </div>
      )}
    </div>
  )
}

/** One day in the week-ahead strip: a compact day label and up to
 *  `maxEvents` lines. Mock: `broadsheet-v2.jsx:194-209`. */
function WeekAheadDay({ day, maxEvents, first }: { day: CalendarDay; maxEvents: number; first: boolean }) {
  const events = day.events ?? []
  const visible = events.slice(0, maxEvents)
  const hidden = events.length - visible.length

  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: '60px 1fr', padding: '4px 0', borderTop: first ? 'none' : '1px dotted var(--rule)' }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-muted)', paddingTop: 3 }}>
        <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{WEEK_DAY_ABBR.format(day.date)}</span> {WEEK_DAY_DATE.format(day.date)}
      </div>
      <div className="min-w-0">
        {events.length === 0 ? (
          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12, color: 'var(--ink-muted)' }}>—</span>
        ) : (
          visible.map((event) => (
            <div
              key={event.id}
              style={{ fontFamily: 'var(--font-display)', fontSize: 13, lineHeight: 1.3, color: 'var(--ink)' }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)', marginRight: 6 }}>
                {formatEventTime(event)}
              </span>
              {event.summary || 'Untitled'}
            </div>
          ))
        )}
        {hidden > 0 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontStyle: 'italic', color: 'var(--ink-muted)', marginTop: 1 }}>
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
 * mock's `d.schedule.slice(1, 6)` (5 days); `MAX_WEEK_AHEAD_EVENTS`
 * likewise matches its per-day event cap, live-aware per the brief note on
 * `:34` — a live game narrows this column (`Home`'s `BODY_COLUMNS_LIVE`),
 * so each day gets one line instead of two while it's live.
 */
const MAX_WEEK_AHEAD_DAYS = 5
const MAX_WEEK_AHEAD_EVENTS = 2
const MAX_WEEK_AHEAD_EVENTS_LIVE = 1

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
              <WeekAheadDay key={day.label} day={day} maxEvents={maxWeekAheadEvents} first={i === 0} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
