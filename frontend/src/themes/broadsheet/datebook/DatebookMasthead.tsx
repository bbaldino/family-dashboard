import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import { mastheadKickerStyle, mastheadNumeralStyle } from '@/themes/broadsheet/ui/masthead-styles'
import { ordinalSuffix } from '@/themes/broadsheet/home/ordinal'
import type { MonthTally } from './tally'
import { formatMonthYear, shiftMonth } from './month-nav'

const navButtonStyle = {
  all: 'unset' as const,
  cursor: 'pointer',
  width: 28,
  height: 28,
  border: '1px solid var(--rule)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const standfirstProseStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 15,
  lineHeight: 1.4,
  color: 'var(--ink)',
}

const standfirstSummaryStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-muted)',
}

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'long' })

/**
 * The Datebook's masthead: the same three-column frame as Home's
 * (`MastheadFrame`), month navigation on the left, the displayed month as
 * the 72px centrepiece, and the Tally on the right — followed by the
 * standfirst row (kicker, month-level prose, "Today" line). Mock:
 * `calendar.jsx:228-262`.
 *
 * `year`/`month` and the nav callbacks are owned by the screen
 * (`Calendar.tsx`), not fetched here — there's no route parameter for a
 * month, so this stays a straightforward render of state threaded down,
 * the same pattern Home's `Masthead` uses for its standfirst summary.
 */
export function DatebookMasthead({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  tally,
  standfirst,
  now,
}: {
  year: number
  month: number
  onPrevMonth: () => void
  onNextMonth: () => void
  tally: MonthTally
  standfirst: string
  /** Today's real date, for the standfirst's "Today · Weekday Nth" line —
   *  independent of which month is displayed. */
  now: Date
}) {
  const prev = shiftMonth(year, month, -1)
  const next = shiftMonth(year, month, 1)
  const todayOrdinal = ordinalSuffix(now.getDate())

  return (
    <div>
      <MastheadFrame
        left={
          <>
            {/* "Browse", not "The Datebook". The suite's masthead rule is that
                the centre names or states the page and both ears carry live
                data — no ear is a second name. The centre already says which
                month this is and the nav tab says which screen, so a third
                label was the one thing here that never changed. This kicker
                now labels what sits under it: a control. */}
            <div style={mastheadKickerStyle}>Browse</div>
            <div
              className="flex items-center"
              style={{
                gap: 8,
                color: 'var(--ink-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}
            >
              <button
                type="button"
                style={navButtonStyle}
                onClick={onPrevMonth}
                aria-label="Previous month"
              >
                ‹
              </button>
              <span style={{ letterSpacing: '0.12em' }}>
                {formatMonthYear(prev.year, prev.month)} · {formatMonthYear(next.year, next.month)}
              </span>
              <button
                type="button"
                style={navButtonStyle}
                onClick={onNextMonth}
                aria-label="Next month"
              >
                ›
              </button>
            </div>
          </>
        }
        center={
          <>
            <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>This month</div>
            <h1 className="m-0" style={mastheadNumeralStyle}>
              {formatMonthYear(year, month)}
            </h1>
          </>
        }
        right={
          <>
            <div style={{ ...mastheadKickerStyle, textAlign: 'right' }}>The Tally</div>
            <div
              className="flex justify-end"
              style={{ gap: 14, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' }}
            >
              <span>
                <span style={{ color: 'var(--rust)', fontWeight: 700 }}>{tally.eventCount}</span>{' '}
                events
              </span>
              {/* Birthdays are omitted entirely rather than printed as "0
               *  birthdays" — see `tally.ts`'s header comment on why the
               *  count is so often zero for this household's own calendar
               *  selection. Flights have no data source anywhere in this
               *  codebase and are never rendered at all, not even omitted
               *  conditionally like birthdays — there's no field to check. */}
              {tally.birthdayCount > 0 && (
                <span>
                  <span style={{ color: 'var(--forest)', fontWeight: 700 }}>
                    {tally.birthdayCount}
                  </span>{' '}
                  birthdays
                </span>
              )}
            </div>
          </>
        }
      />

      <div
        className="grid items-baseline"
        style={{
          gridTemplateColumns: 'auto 1fr auto',
          gap: 18,
          padding: '8px 56px 10px',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <Kicker>↘ from the house</Kicker>
        <p className="m-0" style={standfirstProseStyle}>
          {standfirst} <span style={{ color: 'var(--ink-muted)' }}>— warmly, the house.</span>
        </p>
        <span style={standfirstSummaryStyle}>
          Today · {WEEKDAY_FORMAT.format(now)} {now.getDate()}
          {todayOrdinal}
        </span>
      </div>
    </div>
  )
}
