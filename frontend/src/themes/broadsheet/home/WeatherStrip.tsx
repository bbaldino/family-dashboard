import {
  Sun,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  CloudSnow,
  CloudFog,
  type LucideIcon,
} from 'lucide-react'
import { useWeatherData, useWeatherForecast, useAirQuality } from '@/data/weather'
import type { AqiLevel, UvLevel, PollenLevel } from '@/data/weather'

/** A step deeper than `--paper` for the strip's background — the mock's
 *  `C.paperDeep`. No token for it (see the design brief's guidance on
 *  `ruleSoft`/`ink2`/`accent2`: approximate with what exists unless a token
 *  earns its place, the same reasoning `ScheduleColumn`'s `RULE_SOFT` and
 *  `HouseholdColumn`'s `SOFT_ACCENT` already use for their own mock-only
 *  colours). */
const PAPER_DEEP = 'color-mix(in srgb, var(--ink) 6%, var(--paper))'

/** The mock's `C.ruleSoft` — a rule that recedes rather than draws a line,
 *  for the hourly grid's internal column dividers. Same formula as
 *  `ScheduleColumn`'s `RULE_SOFT`, redefined here rather than imported: this
 *  codebase's established pattern (see `HouseholdColumn`'s `SOFT_ACCENT`) is
 *  each file re-deriving these from the shared tokens rather than a
 *  cross-file color util. */
const RULE_SOFT = 'color-mix(in srgb, var(--rule) 25%, var(--paper))'

/** The mock's `C.accent2`, a muted gold distinct from `--rust`. Same formula
 *  as `HouseholdColumn`'s `SOFT_ACCENT`. */
const ACCENT2 = 'color-mix(in srgb, var(--rust) 55%, var(--ink-muted) 45%)'

const CONDITION_ICONS: Record<string, LucideIcon> = {
  Clear: Sun,
  Clouds: Cloud,
  Rain: CloudRain,
  Drizzle: CloudDrizzle,
  Thunderstorm: CloudLightning,
  Snow: CloudSnow,
  Mist: CloudFog,
  Fog: CloudFog,
  Haze: CloudFog,
}

function iconForCondition(condition: string): LucideIcon {
  return CONDITION_ICONS[condition] ?? Cloud
}

/** "6:14a" — unix seconds to a compact local clock, lowercase meridiem
 *  letter only (matches the masthead's `ampm.toLowerCase()` but tighter,
 *  for the strip's 9-10px mono cells). */
function formatClockCompact(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  const h24 = d.getHours()
  const meridiem = h24 >= 12 ? 'p' : 'a'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}${meridiem}`
}

/** "3p" — unix seconds to a bare hour label for the hourly grid's mono 9px
 *  time column. */
function formatHourCompact(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  const h24 = d.getHours()
  const meridiem = h24 >= 12 ? 'p' : 'a'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h}${meridiem}`
}

const COMPASS_POINTS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
]

function compassDirection(deg: number): string {
  const index = Math.round(deg / 22.5) % 16
  return COMPASS_POINTS[index]
}

/** Display words for the backend's level slugs — a presentation concern
 *  (fitting the strip's tight mono cells), while the *thresholds* that
 *  decide which slug a reading gets live in one place server-side
 *  (`backend/src/integrations/weather/air_quality.rs`). */
const AQI_LABELS: Record<AqiLevel, string> = {
  good: 'GOOD',
  moderate: 'MODERATE',
  unhealthy_sensitive: 'SENSITIVE',
  unhealthy: 'UNHEALTHY',
  very_unhealthy: 'V.UNHEALTHY',
  hazardous: 'HAZARDOUS',
}

const UV_LABELS: Record<UvLevel, string> = {
  low: 'LOW',
  moderate: 'MODERATE',
  high: 'HIGH',
  very_high: 'V.HIGH',
  extreme: 'EXTREME',
}

const POLLEN_LABELS: Record<PollenLevel, string> = {
  none: 'NONE',
  low: 'LOW',
  moderate: 'MOD',
  high: 'HIGH',
  very_high: 'V.HIGH',
}

const cellLabelStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  color: 'var(--ink-muted)',
  letterSpacing: '0.18em',
} as const

/**
 * The full-width band above the footer, per the design mock's `GlanceStrip`
 * (`broadsheet-v2.jsx:548-609` — the mock's name; unrelated to this
 * codebase's `HouseholdColumn`). Five cells, left to right: sunrise/sunset,
 * the 3-hourly forecast, AQI, UV/pollen, wind/humidity. Rendered by `Home`
 * between the three-column body and the footer.
 *
 * Every cell is independently guarded and pinned to its own grid column via
 * an explicit `gridColumn` — not just conditionally rendered in DOM order —
 * so a missing cell leaves a gap rather than shifting its neighbours into
 * the wrong template column (the sun cell is `auto`-sized, wind/hum is
 * `auto`-sized, but the hourly grid is `1fr`; if hourly's sibling shifted
 * into its slot on a missing sun cell, it would stop stretching to fill the
 * strip). The strip itself renders nothing if every source is empty, the
 * same top-level gate `HouseholdColumn` uses, rather than drawing an empty
 * bordered band with nothing in it.
 */
export function WeatherStrip() {
  const { data: current } = useWeatherData()
  const { data: forecast } = useWeatherForecast()
  const { data: air } = useAirQuality()

  const hasSun = !!current && !!current.sunrise && !!current.sunset
  const hourly = forecast?.hourly ?? []
  const hasHourly = hourly.length > 0
  const hasAqi = air?.aqi != null && air.aqi_level != null
  const hasUv = air?.uv_index != null && air.uv_level != null
  const hasPollen = air?.pollen != null && air.pollen_level != null
  const hasWind = !!current

  const hasAnything = hasSun || hasHourly || hasAqi || hasUv || hasWind
  if (!hasAnything) return null

  return (
    <div
      data-testid="weather-strip"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto auto',
        gap: 28,
        alignItems: 'center',
        padding: '8px 56px 10px',
        borderTop: '1px solid var(--rule)',
        // No bottom border: the footer's double rule sits directly against
        // this edge, so a hairline here reads as a second, stray rule rather
        // than a boundary. The mock stacks both, but its footer rule is
        // full-bleed — ours would need to match for that to read as one.

        background: PAPER_DEEP,
        // `Home` stacks this as a flex child between the body and the
        // footer's height-reserving spacer. The body is the only item with
        // `flex-1` and already carries `overflow-hidden`/`min-h-0` to absorb
        // any real overflow by clipping — `flexShrink: 0` here (matching the
        // spacer) keeps this strip and its cells un-squeezed even in a
        // pathological case, so it's always the body that clips, never this.
        flexShrink: 0,
      }}
    >
      {/* 1: Sun arc */}
      {hasSun && current && (
        <div style={{ gridColumn: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sun size={16} strokeWidth={1.5} style={{ color: ACCENT2 }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', lineHeight: 1.3, color: 'var(--ink)' }}>
            <div>
              <span style={{ color: 'var(--ink-muted)' }}>UP</span> {formatClockCompact(current.sunrise)}
            </div>
            <div>
              <span style={{ color: 'var(--ink-muted)' }}>DOWN</span> {formatClockCompact(current.sunset)}
            </div>
          </div>
        </div>
      )}

      {/* 2: 3-hourly forecast — OpenWeather's free tier is 3-hour steps, not
       *  hourly; each column's own time label carries the actual point in
       *  time rather than implying finer resolution. */}
      {hasHourly && (
        <div style={{ gridColumn: 2, display: 'grid', gridTemplateColumns: `repeat(${hourly.length}, 1fr)`, gap: 0, minWidth: 0 }}>
          {hourly.map((h, i) => {
            const heat = Math.max(0, Math.min(1, (h.temp - 50) / 30))
            const Icon = iconForCondition(h.condition)
            return (
              <div
                key={h.dt}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  borderLeft: i === 0 ? 'none' : `1px solid ${RULE_SOFT}`,
                  padding: '0 2px',
                }}
              >
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-muted)', letterSpacing: '0.04em' }}>
                  {formatHourCompact(h.dt)}
                </span>
                <Icon size={14} strokeWidth={1.4} style={{ color: heat > 0.7 ? 'var(--rust)' : 'var(--ink-muted)' }} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 500, lineHeight: 1, color: 'var(--ink)' }}>
                  {Math.round(h.temp)}°
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 3: AQI */}
      {hasAqi && air && (
        <div style={{ gridColumn: 3, textAlign: 'center', minWidth: 70 }}>
          <div style={cellLabelStyle}>AIR · AQI</div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 500,
              lineHeight: 1,
              color: air.aqi_level === 'good' ? 'var(--forest)' : 'var(--ink)',
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 6,
            }}
          >
            <span>{air.aqi}</span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.1em',
                color: air.aqi_level === 'good' ? 'var(--forest)' : 'var(--ink-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {AQI_LABELS[air.aqi_level!]}
            </span>
          </div>
        </div>
      )}

      {/* 4: UV / pollen — pollen is `null` for any US location (Open-Meteo's
       *  pollen coverage is Europe-only), so this shows UV alone rather than
       *  hiding real, working UV data over a field that's structurally
       *  unavailable here. */}
      {hasUv && air && (
        <div style={{ gridColumn: 4, textAlign: 'center', minWidth: 60 }}>
          <div style={cellLabelStyle}>{hasPollen ? 'UV · POLLEN' : 'UV INDEX'}</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, lineHeight: 1.2, marginTop: 2, whiteSpace: 'nowrap', color: 'var(--ink)' }}>
            {Math.round(air.uv_index!)}{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: ACCENT2, letterSpacing: '0.04em' }}>
              {UV_LABELS[air.uv_level!]}
            </span>
            {hasPollen && (
              <>
                <span style={{ margin: '0 4px', color: 'var(--rule)' }}>·</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-muted)' }}>
                  {POLLEN_LABELS[air.pollen_level!]}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 5: Wind / humidity */}
      {hasWind && current && (
        <div style={{ gridColumn: 5, textAlign: 'right', minWidth: 90 }}>
          <div style={cellLabelStyle}>WIND · HUM</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink)', marginTop: 3, letterSpacing: '0.04em' }}>
            {Math.round(current.wind_speed)}mph {compassDirection(current.wind_deg)}
            <br />
            <span style={{ color: 'var(--ink-muted)' }}>{current.humidity}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
