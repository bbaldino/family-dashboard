import { useState, useEffect } from 'react'
import type { WeatherData } from './WeatherWidget'

interface ForecastDay {
  datetime: string
  condition: string
  temperature: number
  templow: number
  wind_speed?: number
}

const conditionIcons: Record<string, string> = {
  'clear-night': '\u{1F319}',
  cloudy: '\u2601\uFE0F',
  fog: '\u{1F32B}\uFE0F',
  hail: '\u{1F327}\uFE0F',
  lightning: '\u26A1',
  'lightning-rainy': '\u26A1',
  partlycloudy: '\u26C5',
  pouring: '\u{1F327}\uFE0F',
  rainy: '\u{1F326}\uFE0F',
  snowy: '\u2744\uFE0F',
  'snowy-rainy': '\u{1F328}\uFE0F',
  sunny: '\u2600\uFE0F',
  windy: '\u{1F4A8}',
  'windy-variant': '\u{1F4A8}',
  exceptional: '\u26A0\uFE0F',
}

const conditionLabels: Record<string, string> = {
  'clear-night': 'Clear',
  cloudy: 'Cloudy',
  fog: 'Foggy',
  hail: 'Hail',
  lightning: 'Storms',
  'lightning-rainy': 'Storms',
  partlycloudy: 'Partly Cloudy',
  pouring: 'Heavy Rain',
  rainy: 'Rainy',
  snowy: 'Snowy',
  'snowy-rainy': 'Sleet',
  sunny: 'Sunny',
  windy: 'Windy',
  'windy-variant': 'Windy',
  exceptional: 'Unusual',
}

export function WeatherDetail({ weather }: { weather: WeatherData }) {
  const [forecast, setForecast] = useState<ForecastDay[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ha/weather-forecast')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
      .then(setForecast)
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div>
      {/* Current conditions */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-[48px]">{weather.icon}</span>
        <div>
          <div className="text-[36px] font-light text-text-primary leading-none">
            {weather.temperature}&deg;
          </div>
          <div className="text-[16px] text-text-secondary">{weather.condition}</div>
          {weather.humidity != null && (
            <div className="text-[13px] text-text-muted">
              {weather.humidity}% humidity
            </div>
          )}
        </div>
      </div>

      {/* 5-day forecast */}
      <h3 className="text-[13px] font-bold text-text-secondary uppercase tracking-[0.5px] mb-3">
        5-Day Forecast
      </h3>

      {error ? (
        <div className="text-[13px] text-error">Failed to load forecast</div>
      ) : forecast.length === 0 ? (
        <div className="text-[13px] text-text-muted">Loading forecast...</div>
      ) : (
        <div className="flex gap-3">
          {forecast.slice(0, 5).map((day, i) => {
            const date = new Date(day.datetime)
            const dayName =
              i === 0
                ? 'Today'
                : date.toLocaleDateString([], { weekday: 'short' })
            const icon = conditionIcons[day.condition] ?? '\u2601\uFE0F'
            const label = conditionLabels[day.condition] ?? day.condition

            return (
              <div
                key={day.datetime}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl ${
                  i === 0
                    ? 'bg-[color-mix(in_srgb,var(--color-info)_8%,transparent)]'
                    : 'bg-bg-primary'
                }`}
              >
                <span className="text-[12px] font-semibold text-text-secondary">
                  {dayName}
                </span>
                <span className="text-[28px]">{icon}</span>
                <div className="text-center">
                  <div className="text-[16px] font-semibold text-text-primary">
                    {Math.round(day.temperature)}&deg;
                  </div>
                  <div className="text-[13px] text-text-muted">
                    {Math.round(day.templow)}&deg;
                  </div>
                </div>
                <span className="text-[11px] text-text-muted text-center">
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
