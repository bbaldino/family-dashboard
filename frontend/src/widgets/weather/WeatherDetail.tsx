import { useState, useEffect } from 'react'

interface ForecastDay {
  date: string
  temp_max: number
  temp_min: number
  humidity: number
  pop: number
  condition: string
  description: string
  icon: string
}

interface HourlyEntry {
  dt: number
  temp: number
  condition: string
  description: string
  icon: string
  pop: number
  humidity: number
}

interface ForecastData {
  daily: ForecastDay[]
  hourly: HourlyEntry[]
}

const conditionIcons: Record<string, string> = {
  Clear: '\u2600\uFE0F',
  Clouds: '\u2601\uFE0F',
  Rain: '\u{1F327}\uFE0F',
  Drizzle: '\u{1F326}\uFE0F',
  Thunderstorm: '\u26A1',
  Snow: '\u2744\uFE0F',
  Mist: '\u{1F32B}\uFE0F',
  Fog: '\u{1F32B}\uFE0F',
  Haze: '\u{1F32B}\uFE0F',
}

export function WeatherDetail() {
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/weather/forecast')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then(setForecast)
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return <div className="text-[13px] text-error p-4">Failed to load forecast</div>
  }

  if (!forecast) {
    return <div className="text-[13px] text-text-muted p-4">Loading forecast...</div>
  }

  return (
    <div>
      {/* Hourly forecast (next 24 hours in 3-hour blocks) */}
      <h3 className="text-[13px] font-bold text-text-secondary uppercase tracking-[0.5px] mb-3">
        Next 24 Hours
      </h3>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {forecast.hourly.map((hour) => {
          const time = new Date(hour.dt * 1000).toLocaleTimeString([], {
            hour: 'numeric',
          })
          const icon = conditionIcons[hour.condition] ?? '\u2601\uFE0F'

          return (
            <div
              key={hour.dt}
              className="flex flex-col items-center gap-1 min-w-[64px] p-2 rounded-xl bg-bg-primary"
            >
              <span className="text-[11px] font-medium text-text-secondary">{time}</span>
              <span className="text-[22px]">{icon}</span>
              <span className="text-[14px] font-semibold text-text-primary">
                {Math.round(hour.temp)}&deg;
              </span>
              {hour.pop > 0 && (
                <span className="text-[10px] text-info font-medium">
                  {Math.round(hour.pop)}%
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Daily forecast */}
      <h3 className="text-[13px] font-bold text-text-secondary uppercase tracking-[0.5px] mb-3">
        5-Day Forecast
      </h3>
      <div className="flex flex-col gap-2">
        {forecast.daily.map((day, i) => {
          const date = new Date(day.date + 'T12:00:00')
          const dayName = i === 0
            ? 'Today'
            : i === 1
              ? 'Tomorrow'
              : date.toLocaleDateString([], { weekday: 'long' })
          const icon = conditionIcons[day.condition] ?? '\u2601\uFE0F'

          return (
            <div
              key={day.date}
              className={`flex items-center gap-4 p-3 rounded-xl ${
                i === 0 ? 'bg-[color-mix(in_srgb,var(--color-info)_6%,transparent)]' : 'bg-bg-primary'
              }`}
            >
              <span className="text-[14px] font-medium text-text-primary w-[100px]">
                {dayName}
              </span>
              <span className="text-[24px]">{icon}</span>
              <div className="flex-1">
                <span className="text-[13px] text-text-secondary capitalize">
                  {day.description}
                </span>
              </div>
              {day.pop > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-[12px]">💧</span>
                  <span className="text-[12px] text-info font-medium">{Math.round(day.pop)}%</span>
                </div>
              )}
              <div className="text-right w-[80px]">
                <span className="text-[15px] font-semibold text-text-primary">
                  {Math.round(day.temp_max)}&deg;
                </span>
                <span className="text-[13px] text-text-muted ml-1">
                  {Math.round(day.temp_min)}&deg;
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
