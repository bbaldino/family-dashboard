import { useEffect, useRef } from 'react'
import type { CalendarEvent } from '@/providers/google-calendar'
import { isAllDay, formatEventTime } from '@/themes/broadsheet/home/event-format'
import { ordinalSuffix } from '@/themes/broadsheet/home/ordinal'
import { CELL_RULE, FOREST_SOFT } from './colors'
import { formatEventLength } from './event-length'

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long' })

const monoCaps = {
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase' as const,
}

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '92px 1fr',
  gap: 16,
  padding: '12px 0',
  alignItems: 'baseline',
}

const titleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: 20,
  fontWeight: 500,
  lineHeight: 1.2,
  color: 'var(--ink)',
}

/** "9:00 AM" with the meridiem set smaller, as in the mock. */
function TimeLabel({ event }: { event: CalendarEvent }) {
  const time = formatEventTime(event)
  const [clock, meridiem] = time.split(/\s+(?=[AP]M$)/i)
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--rust)',
      }}
    >
      {clock}
      {meridiem && <span style={{ fontSize: 10 }}> {meridiem}</span>}
    </span>
  )
}

/**
 * Every event on one day of the Datebook, for a day whose cell had to hide
 * some ("+N more"). Laid over the month behind a wash, the way the doorbell
 * slip is, and closed by the × button, a tap on the wash, or Escape.
 *
 * Read-only: there is no event detail view for a row to open.
 *
 * `events` is shown as given — `byDate`'s order, all-day first and then by
 * start time — and includes the multi-day events the grid draws as banners,
 * since this is the one place that lists the whole day.
 */
export function DaySheet({
  date,
  events,
  onClose,
}: {
  date: Date
  events: CalendarEvent[]
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => prevFocus?.focus?.()
  }, [])

  const dayNum = date.getDate()
  const heading = `${MONTH_FORMAT.format(date)} ${dayNum}${ordinalSuffix(dayNum)}`
  const countLabel = `${events.length} ${events.length === 1 ? 'event' : 'events'}`

  return (
    <>
      {/* The wash and the card are separate layers, not one wrapper, so the
          tapped day's cell (lifted to z 51 by `DayCell`) can sit between
          them: above the wash, below the card. */}
      <div
        data-testid="day-sheet-backdrop"
        className="fixed inset-0"
        style={{ zIndex: 50, background: 'rgba(25,21,18,0.38)' }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-sheet-title"
        style={{
          position: 'fixed',
          zIndex: 52,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          maxHeight: '86%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--paper)',
          borderTop: '4px solid var(--ink)',
          boxShadow: '0 18px 50px rgba(25,21,18,0.35)',
          padding: '22px 32px 18px',
        }}
      >
        <div className="flex justify-between items-start">
          <div>
            <div
              style={{
                ...monoCaps,
                fontSize: 10,
                letterSpacing: '0.22em',
                color: 'var(--ink-muted)',
              }}
            >
              {WEEKDAY_FORMAT.format(date)} · {countLabel}
            </div>
            <h2
              id="day-sheet-title"
              className="m-0"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 44,
                fontWeight: 500,
                lineHeight: 1.05,
                color: 'var(--ink)',
                marginTop: 4,
              }}
            >
              {heading}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              all: 'unset',
              cursor: 'pointer',
              width: 36,
              height: 36,
              border: '1px solid var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 18,
              color: 'var(--ink)',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ borderTop: '2px solid var(--ink)', marginTop: 14 }} />

        {/* Scrolls only on a day too long for the card — rare, but the canvas
            is fixed and nothing else would show the tail. */}
        <div className="min-h-0" style={{ overflowY: 'auto' }}>
          {events.map((event, i) => {
            const title = event.summary || 'Untitled'
            const divider = i < events.length - 1 ? `1px solid ${CELL_RULE}` : 'none'
            if (isAllDay(event)) {
              return (
                <div
                  key={event.id + '-' + i}
                  data-testid="day-sheet-event"
                  style={{ ...rowStyle, borderBottom: divider }}
                >
                  <span
                    style={{
                      ...monoCaps,
                      fontSize: 10,
                      letterSpacing: '0.18em',
                      fontWeight: 700,
                      color: 'var(--forest)',
                    }}
                  >
                    All day
                  </span>
                  <span
                    style={{
                      ...titleStyle,
                      borderLeft: '3px solid var(--forest)',
                      paddingLeft: 10,
                      background: FOREST_SOFT,
                    }}
                  >
                    {title}
                  </span>
                </div>
              )
            }
            const detail = [formatEventLength(event), event.location].filter(Boolean).join(' · ')
            return (
              <div
                key={event.id + '-' + i}
                data-testid="day-sheet-event"
                style={{ ...rowStyle, borderBottom: divider }}
              >
                <TimeLabel event={event} />
                <div>
                  <div style={titleStyle}>{title}</div>
                  {detail && (
                    <div
                      style={{
                        ...monoCaps,
                        fontSize: 10,
                        letterSpacing: '0.12em',
                        color: 'var(--ink-muted)',
                        marginTop: 3,
                      }}
                    >
                      {detail}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div
          style={{
            ...monoCaps,
            borderTop: '1px solid var(--ink)',
            marginTop: 4,
            paddingTop: 10,
            fontSize: 9,
            letterSpacing: '0.18em',
            color: 'var(--ink-muted)',
            textAlign: 'center',
          }}
        >
          Tap outside to close
        </div>
      </div>
    </>
  )
}
