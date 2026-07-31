import { useHeroWeather } from '@/data/weather'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
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

/** The mock hand-rolls these labels (`broadsheet-v2.jsx:100,107,114`) rather
 *  than reusing the shared `Kicker` component: 0.28em letter-spacing and no
 *  bold, versus `Kicker`'s 0.26em + bold default used everywhere else on
 *  the page. The masthead's follow-up brief re-specified these values
 *  exactly, so they're hand-rolled to match rather than approximated. */
const mastheadKickerStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.28em',
  textTransform: 'uppercase' as const,
  color: 'var(--ink-muted)',
  marginBottom: 4,
}

/** The one type treatment all three masthead cells share: 72px italic
 *  serif. Mock: `broadsheet-v2.jsx:101,108,119`. */
const numeralStyle = {
  fontFamily: 'var(--font-display)',
  fontStyle: 'italic' as const,
  fontWeight: 400,
  fontSize: 72,
  letterSpacing: '-0.03em',
  lineHeight: 0.9,
  color: 'var(--ink)',
}

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
 * `isLive` and the standfirst's next-event/total-event summary are threaded
 * down from `Home` rather than computed here — `Home` already owns the
 * single `useSportsGames()` call and the calendar data those numbers come
 * from, so this stays a straightforward render of what it's given.
 */
export function Masthead({
  standfirst,
  isLive,
  nextEventSummary,
  totalEvents,
}: {
  standfirst: string
  isLive: boolean
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
      <div
        style={{
          padding: '22px 56px 18px',
          borderBottom: '3px double var(--ink)',
        }}
      >
        {/* All three cells are kicker + 72px numeral only, and nothing
         *  else, so `align-items: end` bottom-aligns their numerals onto
         *  one shared baseline. The weather cell's H/L detail line is
         *  deliberately rendered *outside* this grid, below it — adding a
         *  fourth line to just one cell would make that cell taller than
         *  its siblings, and align-items: end would then anchor its extra
         *  height at the *top*, pushing its kicker and numeral out of line
         *  with the other two. */}
        <div className="grid items-end" style={{ gridTemplateColumns: '0.85fr 1.5fr 0.85fr', gap: 24 }}>
          {/* left: clock */}
          <div>
            <div style={mastheadKickerStyle}>Now</div>
            <div style={numeralStyle}>
              {time}
              <span style={{ fontSize: 32, color: 'var(--ink-muted)', marginLeft: 8 }}>{ampm.toLowerCase()}</span>
            </div>
          </div>

          {/* centre: the date is the masthead's centrepiece — see the
           *  follow-up brief. The plan's "Kitchen Dashboard" wordmark was a
           *  planning invention; the mock never had one. */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...mastheadKickerStyle, textAlign: 'center' }}>Today</div>
            <h1 className="m-0" style={numeralStyle}>
              {weekday}, {month} {dayOfMonth}
              <sup style={ordinalStyle}>{ordinalSuffix(dayOfMonth)}</sup>
            </h1>
          </div>

          {/* right: weather */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...mastheadKickerStyle, textAlign: 'right' }}>
              Outside
              {isLive && <span style={{ color: 'var(--rust)', marginLeft: 6 }}>● LIVE GAME</span>}
            </div>
            {heroWeather ? (
              <div className="flex items-baseline justify-end" style={{ gap: 10 }}>
                {/* Condition-aware icon (mapped from the current condition
                 *  in `useHeroWeather`), not the mock's hard-coded sun. */}
                <span style={{ fontSize: 30, alignSelf: 'center', color: 'var(--forest)' }}>{heroWeather.icon}</span>
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
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}>—</div>
            )}
          </div>
        </div>

        {/* The mock drops the old detail line entirely, but losing the
         *  high/low would be a real loss on a kitchen wall — kept,
         *  restrained to a small muted line so it doesn't compete with the
         *  72px numerals above it. Feels-like/humidity/wind are dropped:
         *  they made the old line the longest thing in the header for the
         *  least essential information at a glance. */}
        {heroWeather && (
          <div style={{ textAlign: 'right', marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-muted)' }}>
            H {heroWeather.high}° · L {heroWeather.low}°
          </div>
        )}
      </div>

      <div
        className="grid items-baseline"
        style={{ gridTemplateColumns: 'auto 1fr auto', gap: 18, padding: '10px 56px 12px', borderBottom: '1px solid var(--rule)' }}
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
