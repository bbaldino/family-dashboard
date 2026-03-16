import type { WeatherData } from './WeatherWidget'

interface WeatherDetailProps {
  weather: WeatherData
}

export function WeatherDetail({ weather }: WeatherDetailProps) {
  return (
    <div>
      <h2 className="text-[18px] font-semibold text-text-primary mb-4">Weather Forecast</h2>
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
        <span className="text-[40px]">{weather.icon}</span>
        <div>
          <div className="text-[32px] font-light text-text-primary">
            {weather.temperature}&deg;
          </div>
          <div className="text-[14px] text-text-secondary">{weather.condition}</div>
        </div>
      </div>
      {weather.forecast && weather.forecast.length > 0 && (
        <div className="flex flex-col gap-2">
          {weather.forecast.map((entry, i) => {
            const date = new Date(entry.datetime)
            const label = date.toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
            return (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <span className="text-[13px] text-text-secondary">{label}</span>
                <span className="text-[14px] text-text-primary font-medium">
                  {entry.temperature}&deg;
                </span>
                <span className="text-[12px] text-text-muted">{entry.condition}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
