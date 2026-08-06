/**
 * Daily-summary aggregation ported from
 * `backend/src/integrations/weather/routes.rs`'s `get_forecast` — OpenWeather's
 * free 5-day/3-hour forecast bucketed into per-day summaries in the browser
 * instead of on the server. Domain logic that exists in both schemes, just in
 * a different language: a relocation, not a saving.
 */

export interface ForecastDay {
  date: string
  temp_max: number
  temp_min: number
  humidity: number
  pop: number
  condition: string
  description: string
  icon: string
}

/** One 3-hour step from OpenWeather's free `/forecast` endpoint — the next 8
 *  entries (24 hours) are surfaced as-is. Not hourly, despite the name of
 *  the endpoint that carries it; the strip that renders these labels each
 *  point's actual time rather than implying a resolution the free tier
 *  doesn't have. */
export interface HourlyForecast {
  dt: number
  temp: number
  condition: string
  description: string
  icon: string
  pop: number
  humidity: number
}

export interface ForecastData {
  daily: ForecastDay[]
  hourly: HourlyForecast[]
}

interface OpenWeatherForecastEntry {
  dt: number
  main: {
    temp: number
    temp_min: number
    temp_max: number
    humidity: number
    [key: string]: unknown
  }
  weather: { main: string; description: string; icon: string; [key: string]: unknown }[]
  pop?: number
  [key: string]: unknown
}

interface OpenWeatherForecastResponse {
  list: OpenWeatherForecastEntry[]
  city?: { timezone?: number; [key: string]: unknown }
  [key: string]: unknown
}

interface DayAccumulator {
  date: string
  temp_max: number
  temp_min: number
  humiditySum: number
  count: number
  popMax: number
  condition: string
  description: string
  icon: string
}

/** OpenWeather's `dt` is UTC unix seconds; `city.timezone` is the location's
 *  UTC offset in seconds (DST-aware). Baking the offset into the timestamp
 *  and then reading UTC getters yields the location's local wall-clock date
 *  and hour without the browser's own timezone getting involved — the same
 *  trick `routes.rs` plays with `chrono::DateTime::from_timestamp(dt +
 *  tz_offset_secs, 0)`. */
function localDateAndHour(dt: number, tzOffsetSecs: number): { date: string; hour: number } {
  const local = new Date((dt + tzOffsetSecs) * 1000)
  const year = local.getUTCFullYear()
  const month = String(local.getUTCMonth() + 1).padStart(2, '0')
  const day = String(local.getUTCDate()).padStart(2, '0')
  return { date: `${year}-${month}-${day}`, hour: local.getUTCHours() }
}

/** Port of `get_forecast`'s daily-bucketing and hourly-slicing. */
export function summariseForecast(raw: OpenWeatherForecastResponse): ForecastData {
  const tzOffsetSecs = raw.city?.timezone ?? 0
  const list = raw.list ?? []

  const byDate = new Map<string, DayAccumulator>()

  for (const item of list) {
    const { date, hour } = localDateAndHour(item.dt, tzOffsetSecs)
    const weather = item.weather[0]
    const pop = item.pop ?? 0

    let acc = byDate.get(date)
    if (!acc) {
      acc = {
        date,
        temp_max: item.main.temp_max,
        temp_min: item.main.temp_min,
        humiditySum: 0,
        count: 0,
        popMax: 0,
        condition: '',
        description: '',
        icon: '',
      }
      byDate.set(date, acc)
    } else {
      acc.temp_max = Math.max(acc.temp_max, item.main.temp_max)
      acc.temp_min = Math.min(acc.temp_min, item.main.temp_min)
    }

    acc.humiditySum += item.main.humidity
    acc.count += 1
    acc.popMax = Math.max(acc.popMax, pop)

    // Midday (12:00-15:00 local) weather is representative; the first entry
    // of the day wins by default (acc.condition starts empty) until a
    // midday entry overwrites it — same rule as `routes.rs`.
    if ((hour >= 12 && hour <= 15) || acc.condition === '') {
      acc.condition = weather?.main ?? ''
      acc.description = weather?.description ?? ''
      acc.icon = weather?.icon ?? ''
    }
  }

  const daily: ForecastDay[] = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((acc) => ({
      date: acc.date,
      temp_max: Math.round(acc.temp_max * 10) / 10,
      temp_min: Math.round(acc.temp_min * 10) / 10,
      humidity: Math.round(acc.humiditySum / acc.count),
      pop: Math.round(acc.popMax * 100),
      condition: acc.condition,
      description: acc.description,
      icon: acc.icon,
    }))

  const hourly: HourlyForecast[] = list.slice(0, 8).map((item) => ({
    dt: item.dt,
    temp: item.main.temp,
    condition: item.weather[0]?.main ?? '',
    description: item.weather[0]?.description ?? '',
    icon: item.weather[0]?.icon ?? '',
    pop: Math.round((item.pop ?? 0) * 100),
    humidity: item.main.humidity,
  }))

  return { daily, hourly }
}
