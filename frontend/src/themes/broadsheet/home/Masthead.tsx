import { useHeroWeather, useWeatherData } from '@/data/weather'
import { DoubleRule } from '@/themes/broadsheet/ui/DoubleRule'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { useNow } from './useNow'

/** "h:mm" with no leading zero, plus a separate upper-case AM/PM. */
function formatClock(now: Date): { time: string; ampm: string } {
  const hours24 = now.getHours()
  const ampm = hours24 >= 12 ? 'PM' : 'AM'
  const hours = hours24 % 12 === 0 ? 12 : hours24 % 12
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return { time: `${hours}:${minutes}`, ampm }
}

const LONG_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

/**
 * The paper's front-page header: the moment (time + date), the title, and
 * the weather — three columns under nothing but rules. Standfirst prose
 * follows beneath, then a double rule closes the section.
 */
export function Masthead({ standfirst }: { standfirst: string }) {
  const now = useNow()
  const heroWeather = useHeroWeather()
  const { data: weatherData } = useWeatherData()

  const { time, ampm } = formatClock(now)
  const longDate = LONG_DATE_FORMAT.format(now)

  return (
    <div className="px-14 pt-6 pb-4">
      <div className="grid gap-6 items-end" style={{ gridTemplateColumns: '0.85fr 1.5fr 0.85fr' }}>
        {/* left: time + date */}
        <div>
          <Kicker>Now</Kicker>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 56,
              lineHeight: 0.9,
              color: 'var(--ink)',
            }}
          >
            {time}
            <span style={{ fontSize: 22, marginLeft: 8, color: 'var(--ink-muted)' }}>{ampm}</span>
          </div>
          <div
            className="mt-2"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 20,
              color: 'var(--ink-muted)',
            }}
          >
            {longDate}
          </div>
        </div>

        {/* centre: masthead title */}
        <h1
          className="text-center m-0"
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 72,
            letterSpacing: '-0.03em',
            lineHeight: 0.9,
            color: 'var(--ink)',
          }}
        >
          Kitchen Dashboard
        </h1>

        {/* right: weather — only what we actually collect */}
        <div className="text-right">
          <Kicker className="flex justify-end">Outside</Kicker>
          {heroWeather ? (
            <>
              <div className="flex items-baseline justify-end gap-2">
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'italic',
                    fontSize: 56,
                    lineHeight: 0.9,
                    color: 'var(--ink)',
                  }}
                >
                  {heroWeather.temperature}°
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'italic',
                    fontSize: 22,
                    color: 'var(--ink-muted)',
                  }}
                >
                  {heroWeather.condition}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}>
                H {heroWeather.high}&deg; &middot; L {heroWeather.low}&deg;
                {weatherData
                  ? ` · feels ${Math.round(weatherData.feels_like)}° · ${Math.round(weatherData.humidity)}% humidity · wind ${Math.round(weatherData.wind_speed)} mph`
                  : ''}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-muted)' }}>&mdash;</div>
          )}
        </div>
      </div>

      <p
        className="mt-4 mb-3"
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 20,
          lineHeight: 1.4,
          color: 'var(--ink)',
        }}
      >
        {standfirst}
      </p>

      <DoubleRule />
    </div>
  )
}
