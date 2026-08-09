import { useHeroWeather } from '@/integrations/weather'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { MastheadFrame } from '@/themes/broadsheet/ui/MastheadFrame'
import {
  mastheadKickerStyle,
  mastheadNumeralStyle as numeralStyle,
} from '@/themes/broadsheet/ui/masthead-styles'
import { ordinalSuffix } from './ordinal'
import { useNow } from './useNow'

/** "h:mm" with no leading zero, plus a separate upper-case AM/PM. */
function formatClock(now: Date): { time: string; ampm: string } {
  const hours24 = now.getHours()
  const ampm = hours24 >= 12 ? 'PM' : 'AM'
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return { time: `${hours}:${minutes}`, ampm }
}

// Separate formatters, joined explicitly as "Weekday, Month" — combining
// `weekday` and `month` into a single Intl.DateTimeFormat lets ICU pick the
// field order, which in this environment comes out "July Friday" rather
// than the mock's "Friday, May 22" (`broadsheet-v2.jsx:109`).
const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long' })

/** The date's ordinal suffix, raised and shrunk. `position: relative` is
 *  added to make the mock's literal `top: '-0.65em'` (`broadsheet-v2.jsx:109`)
 *  actually take effect — a statically-positioned element ignores `top`. */
const ordinalStyle = {
  fontSize: 30,
  fontStyle: 'italic' as const,
  fontWeight: 400,
  position: 'relative' as const,
  top: '-0.65em',
}

const standfirstProseStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontSize: 16.5,
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

/**
 * The paper's front-page header. Two rows: the masthead proper — clock,
 * date, weather, all sharing one 72px italic-serif treatment, closed by a
 * triple rule — and beneath it the standfirst: a byline, the day's prose
 * from the house, and a compact "what's next" summary. Mock:
 * `broadsheet-v2.jsx:97-134`.
 *
 * The standfirst's next-event/total-event summary is threaded down from
 * `Home` rather than computed here — `Home` already owns the calendar data
 * those numbers come from, so this stays a straightforward render of what
 * it's given. There is no live-game indicator here any more — the mock
 * dropped the weather cell's kicker entirely (`broadsheet-v2.jsx:115-117`),
 * which was the only place live-game state surfaced in the masthead; the
 * sports column still shows it.
 */
export function Masthead({
  standfirst,
  nextEventSummary,
  totalEvents,
}: {
  standfirst: string
  nextEventSummary: string
  totalEvents: number
}) {
  const now = useNow()
  const heroWeather = useHeroWeather()

  const { time, ampm } = formatClock(now)
  const weekday = WEEKDAY_FORMAT.format(now)
  const month = MONTH_FORMAT.format(now)
  const dayOfMonth = now.getDate()

  return (
    <div>
      {/* Clock and date are kicker + 72px numeral; weather is the 72px
       *  numeral row alone (its kicker was removed, not hidden — see
       *  below). `align-items: end` (on `MastheadFrame`'s inner grid)
       *  bottom-aligns all three cells' numerals onto one shared baseline
       *  regardless of that height difference, because it anchors each
       *  cell's *bottom* edge, and the numeral is the last (and, for
       *  weather, only) line in every cell.
       *
       *  Nothing else goes in this grid. The day's high/low used to hang
       *  below it as a full-width `footer` row, which is what made the
       *  masthead taller than the design: two small numbers buying a whole
       *  line of vertical space at the top of the screen. It now lives in
       *  `WeatherStrip`, with the rest of the day's readouts, where the row
       *  it joins was already that tall. Anything similar belongs there too
       *  — a line added to a single cell here would make that cell taller
       *  than its siblings, and `align-items: end` would anchor the extra
       *  height at the *top*, pushing that numeral off the shared
       *  baseline. */}
      <MastheadFrame
        left={
          <>
            <div style={mastheadKickerStyle}>Now</div>
            <div style={numeralStyle}>
              {time}
              <span style={{ fontSize: 32, color: 'var(--ink-muted)', marginLeft: 8 }}>
                {ampm.toLowerCase()}
              </span>
            </div>
          </>
        }
        center={
          // the date is the masthead's centrepiece — see the follow-up
          // brief. The plan's "Kitchen Dashboard" wordmark was a planning
          // invention; the mock never had one.
          <>
            <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>Today</div>
            <h1 className="m-0" style={numeralStyle}>
              {weekday}, {month} {dayOfMonth}
              <sup style={ordinalStyle}>{ordinalSuffix(dayOfMonth)}</sup>
            </h1>
          </>
        }
        right={
          // No kicker line here any more — the mock removed the "Outside"
          // label (and the live-game indicator that rode along with it)
          // entirely rather than hiding it, so unlike the clock/date cells
          // this one's first line is the numeral row itself. `align-items:
          // end` still bottom-aligns the three cells' numerals onto a
          // shared baseline regardless — verified live, not just by
          // inspection: a previous change to this exact cell broke that
          // alignment in a way no test caught.
          heroWeather ? (
            <div className="flex items-baseline justify-end" style={{ gap: 10 }}>
              {/* Condition-aware icon (mapped from the current condition
               *  in `useHeroWeather`), not the mock's hard-coded sun. */}
              <span style={{ fontSize: 30, alignSelf: 'center', color: 'var(--forest)' }}>
                {heroWeather.icon}
              </span>
              <span style={numeralStyle}>{heroWeather.temperature}°</span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontStyle: 'italic',
                  fontSize: 28,
                  color: 'var(--ink-muted)',
                  lineHeight: 1,
                }}
              >
                {heroWeather.condition.toLowerCase()}
              </span>
            </div>
          ) : (
            <div
              style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}
            >
              —
            </div>
          )
        }
      />

      <div
        className="grid items-baseline"
        style={{
          gridTemplateColumns: 'auto 1fr auto',
          gap: 18,
          padding: '10px 56px 12px',
          borderBottom: '1px solid var(--rule)',
        }}
      >
        <Kicker>↘ from the house</Kicker>
        <p className="m-0" style={standfirstProseStyle}>
          {standfirst} <span style={{ color: 'var(--ink-muted)' }}>— warmly, the house.</span>
        </p>
        <span style={standfirstSummaryStyle}>
          {nextEventSummary} · {totalEvents} events / 7 days
        </span>
      </div>
    </div>
  )
}
