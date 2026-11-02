import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MapPin, Car } from 'lucide-react'
import type { CalendarEvent } from '@/providers/google-calendar'
import type { EventDriveInfo } from '@/integrations/driving-time'
import { formatEventTime } from './event-format'
import { isUnderWay } from './today-docket'

/** A rule lighter than `--rule` (the theme's hairline is full ink) for
 *  dividers that need to recede rather than draw a line — the mock's
 *  `C.ruleSoft`. Computed from the theme's own tokens rather than a new
 *  custom property (see the design brief's guidance on `ruleSoft`/`ink2`/
 *  `accent2`: approximate with what exists unless a token earns its place).
 *  `color-mix` is already how `grid` builds tinted surfaces from its palette
 *  tokens (e.g. `src/themes/grid/ui/WidgetCard.tsx`), so this follows suit. */
const RULE_SOFT = 'color-mix(in srgb, var(--rule) 25%, var(--paper))'

/** Tall enough for five rows at the heights they render (42-59px each); the
 *  rest of the day scrolls inside it, so the week-ahead strip below never moves. */
const DOCKET_MAX_HEIGHT = 250

/** How much of the last finished row stays in view above the NOW rule — about
 *  half a row, so there is visibly something to scroll back up to. */
const PEEK_PX = 50

/** How long the list waits after the last touch before it returns to now. */
const IDLE_MS = 60_000

/** How far from now the list can sit before it counts as scrolled away. */
const AWAY_PX = 8

const NOW_TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

/** One event in the Today hero: time, title + location, drive time. Mock:
 *  `broadsheet-v2.jsx:156-179`. A finished event fades and is struck through;
 *  one under way is tagged, since it sits below a NOW rule that is later than
 *  its start time. */
function TodayEventRow({
  event,
  driveInfo,
  first,
  past,
  onNow,
}: {
  event: CalendarEvent
  driveInfo?: EventDriveInfo
  first: boolean
  past: boolean
  onNow: boolean
}) {
  return (
    <div
      data-testid="today-event"
      data-past={past || undefined}
      className="grid items-baseline gap-3"
      style={{
        gridTemplateColumns: '70px 1fr auto',
        padding: '9px 0',
        borderTop: first ? 'none' : `1px solid ${RULE_SOFT}`,
        opacity: past ? 0.42 : 1,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--ink)',
          }}
        >
          {formatEventTime(event)}
        </div>
        {onNow && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--rust)',
              marginTop: 2,
            }}
          >
            On now
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            fontWeight: 600,
            lineHeight: 1.25,
            color: 'var(--ink)',
            textDecoration: past ? 'line-through' : undefined,
            textDecorationThickness: past ? 1 : undefined,
          }}
        >
          {event.summary || 'Untitled'}
        </div>
        {event.location && (
          <div
            className="flex items-center gap-1 mt-0.5"
            style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: 'var(--ink-muted)' }}
          >
            <MapPin size={11} strokeWidth={1.5} />
            {event.location}
          </div>
        )}
      </div>
      {driveInfo && !past && (
        <div className="text-right">
          <div
            className="flex items-center justify-end gap-1"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--rust)',
              letterSpacing: '0.06em',
            }}
          >
            <Car size={11} strokeWidth={1.5} />
            {driveInfo.displayText}
          </div>
        </div>
      )}
    </div>
  )
}

/** A fade over one edge of the list, shown while there is more to scroll to
 *  in that direction. */
function EdgeFade({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        [edge]: 0,
        height: 34,
        pointerEvents: 'none',
        background: `linear-gradient(to ${edge === 'top' ? 'bottom' : 'top'}, var(--paper), transparent)`,
      }}
    />
  )
}

/**
 * Today's timed events as one scrolling list: the finished ones faded above a
 * NOW rule, everything still to come below it. Replaced 0.22.0's four rows plus
 * a one-line "✓ N earlier" note, which clipped on a busy day and hid what had
 * already happened (2026-11-01).
 *
 * The list keeps itself at now: it opens scrolled so the NOW rule sits near the
 * top with half of the last finished row above it, and moves on by itself as
 * each event ends. Someone scrolling back through the morning is left alone —
 * the list only returns to now when they tap "Back to now", or after a minute
 * with no touch on it.
 */
export function TodayDocket({
  earlier,
  ahead,
  now,
  driveInfo,
}: {
  earlier: CalendarEvent[]
  ahead: CalendarEvent[]
  now: Date
  driveInfo: Record<string, EventDriveInfo>
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const ruleRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lastTouchRef = useRef(-Infinity)
  const idleTimerRef = useRef<number | null>(null)
  const [edges, setEdges] = useState({ above: false, below: false, away: false })

  const nowTop = useCallback(() => {
    const box = boxRef.current
    const rule = ruleRef.current
    if (!box || !rule) return 0
    const maxTop = Math.max(0, box.scrollHeight - box.clientHeight)
    return Math.min(maxTop, Math.max(0, rule.offsetTop - PEEK_PX))
  }, [])

  const measure = useCallback(() => {
    const box = boxRef.current
    if (!box) return
    setEdges({
      above: box.scrollTop > 2,
      below: box.scrollTop + box.clientHeight < box.scrollHeight - 2,
      away: Math.abs(box.scrollTop - nowTop()) > AWAY_PX,
    })
  }, [nowTop])

  const scrollToNow = useCallback(
    (behavior: ScrollBehavior) => {
      boxRef.current?.scrollTo({ top: nowTop(), behavior })
      measure()
    },
    [nowTop, measure],
  )

  const touched = () => {
    lastTouchRef.current = Date.now()
    if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null
      scrollToNow('smooth')
    }, IDLE_MS)
  }

  useEffect(
    () => () => {
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
    },
    [],
  )

  /** Return to now unless the list was touched within the last minute, in
   *  which case the idle timer brings it back once they're done. */
  const followNow = useCallback(
    (behavior: ScrollBehavior) => {
      if (Date.now() - lastTouchRef.current >= IDLE_MS) scrollToNow(behavior)
      else measure()
    },
    [scrollToNow, measure],
  )

  // Open at now, then follow the clock each time an event ends.
  const openedRef = useRef(false)
  useLayoutEffect(() => {
    if (!openedRef.current) {
      openedRef.current = true
      scrollToNow('auto')
    } else {
      followNow('smooth')
    }
  }, [earlier.length, ahead.length, scrollToNow, followNow])

  // Rows change height after the first scroll — the web fonts arriving on the
  // tablet's first boot, a drive time loading in — which moves the NOW rule
  // out from under where the list was left.
  useEffect(() => {
    const content = contentRef.current
    if (!content || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => followNow('auto'))
    observer.observe(content)
    return () => observer.disconnect()
  }, [followNow])

  return (
    <div style={{ position: 'relative', borderTop: '2px solid var(--ink)' }}>
      <div
        ref={boxRef}
        data-testid="today-docket"
        onPointerDown={touched}
        onPointerUp={touched}
        onTouchMove={touched}
        onWheel={touched}
        onScroll={measure}
        style={{
          position: 'relative',
          maxHeight: DOCKET_MAX_HEIGHT,
          overflowY: 'auto',
          scrollbarWidth: 'none',
          overscrollBehavior: 'contain',
        }}
      >
        <div ref={contentRef}>
          {earlier.map((event, i) => (
            <TodayEventRow
              key={event.id}
              event={event}
              driveInfo={driveInfo[event.id]}
              first={i === 0}
              past
              onNow={false}
            />
          ))}
          {earlier.length > 0 && (
            <div
              ref={ruleRef}
              data-testid="now-rule"
              className="flex items-center gap-2"
              style={{ margin: '2px 0' }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  color: 'var(--rust)',
                }}
              >
                NOW · {NOW_TIME.format(now)}
              </span>
              <span style={{ flex: 1, borderTop: '2px solid var(--rust)' }} />
            </div>
          )}
          {ahead.map((event, i) => (
            <TodayEventRow
              key={event.id}
              event={event}
              driveInfo={driveInfo[event.id]}
              first={i === 0}
              past={false}
              onNow={isUnderWay(event, now)}
            />
          ))}
          {ahead.length === 0 && (
            <p
              className="m-0"
              style={{
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                fontSize: 16,
                color: 'var(--ink-muted)',
                lineHeight: 1.4,
                padding: '10px 0',
              }}
            >
              — the rest of the day is clear —
            </p>
          )}
        </div>
      </div>
      {edges.above && <EdgeFade edge="top" />}
      {edges.below && <EdgeFade edge="bottom" />}
      {edges.away && (
        <button
          type="button"
          onClick={() => {
            if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
            idleTimerRef.current = null
            scrollToNow('smooth')
          }}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 8,
            background: 'var(--ink)',
            color: 'var(--paper)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '7px 12px',
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ↓ Back to now
        </button>
      )}
    </div>
  )
}
