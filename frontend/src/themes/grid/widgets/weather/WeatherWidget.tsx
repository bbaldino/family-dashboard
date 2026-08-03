import { WidgetCard } from '@/themes/grid/ui/WidgetCard'
import { useWeatherData, conditionIcons } from '@/data/weather'
import { WeatherDetail } from './WeatherDetail'

export function WeatherWidget() {
  const { data: weather, isLoading, error } = useWeatherData()

  if (isLoading || error || !weather) return null

  const icon = conditionIcons[weather.condition] ?? '☁️'

  return (
    <WidgetCard title="Weather" category="info" detail={<WeatherDetail />}>
      <div className="flex items-center gap-3">
        <span className="text-[36px]">{icon}</span>
        <div>
          <div className="text-[28px] font-light leading-none text-text-primary">
            {Math.round(weather.temp)}&deg;
          </div>
          <div className="text-[13px] text-text-secondary capitalize">{weather.description}</div>
          <div className="text-[11px] text-text-muted">{weather.humidity}% humidity</div>
        </div>
      </div>
    </WidgetCard>
  )
}
