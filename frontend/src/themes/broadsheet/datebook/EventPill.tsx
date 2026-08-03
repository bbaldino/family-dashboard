import type { CalendarEvent } from '@/data/google-calendar'
import { isAllDay, formatEventTime } from '@/themes/broadsheet/home/event-format'
import { ACCENT2, CREAM_SOFT, FOREST_SOFT } from './colors'

/**
 * One event line inside a day cell. Mock: `calendar.jsx:186-214`, two visual
 * kinds — the mock's third kind, `bday`, renders identically to `allday`
 * (per the design brief: "the grid needs no birthday classification — only
 * the tally distinguishes them"), so there is no `bday` branch here; an all-
 * day event renders the same whether or not the Tally counts it as a
 * birthday.
 */
export function EventPill({ event }: { event: CalendarEvent }) {
  const title = event.summary || 'Untitled'

  if (isAllDay(event)) {
    return (
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 11.5,
          fontWeight: 600,
          lineHeight: 1.25,
          color: 'var(--forest)',
          background: FOREST_SOFT,
          borderLeft: '2px solid var(--forest)',
          padding: '2px 6px',
          marginBottom: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </div>
    )
  }

  return (
    <div
      className="flex items-baseline"
      style={{
        gap: 5,
        background: CREAM_SOFT,
        borderLeft: `2px solid ${ACCENT2}`,
        padding: '2px 6px',
        marginBottom: 2,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 700,
          color: ACCENT2,
          flexShrink: 0,
        }}
      >
        {formatEventTime(event)}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 11.5,
          lineHeight: 1.25,
          color: 'var(--ink)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {title}
      </span>
    </div>
  )
}
