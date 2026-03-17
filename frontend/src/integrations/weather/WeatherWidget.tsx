import { WidgetCard } from '@/ui/WidgetCard'
import { usePolling } from '@/hooks/usePolling'
import { WeatherDetail } from './WeatherDetail'
import { weatherIntegration } from './config'

export interface WeatherData {
  temp: number
  feels_like: number
  temp_min: number
  temp_max: number
  humidity: number
  condition: string
  description: string
  icon: string
  wind_speed: number
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

export function useWeatherData() {
  return usePolling<WeatherData>({
    queryKey: ['weather', 'current'],
    fetcher: () => weatherIntegration.api.get<WeatherData>('/current'),
    intervalMs: 15 * 60 * 1000, // 15 minutes
  })
}

export function WeatherWidget() {
  const { data: weather, isLoading, error } = useWeatherData()

  if (isLoading || error || !weather) return null

  const icon = conditionIcons[weather.condition] ?? '\u2601\uFE0F'

  return (
    <WidgetCard
      title="Weather"
      category="info"
      detail={<WeatherDetail />}
    >
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

interface ForecastDay {
  date: string
  temp_max: number
  temp_min: number
}

interface ForecastData {
  daily: ForecastDay[]
}

// For HeroStrip — returns simplified weather info with daily high/low from forecast
export function useHeroWeather(): { temperature: string; high: string; low: string; condition: string; icon: string } | null {
  const { data: current } = useWeatherData()
  const { data: forecast } = usePolling<ForecastData>({
    queryKey: ['weather', 'forecast'],
    fetcher: () => weatherIntegration.api.get<ForecastData>('/forecast'),
    intervalMs: 30 * 60 * 1000, // 30 minutes
  })

  if (!current) return null

  const today = forecast?.daily?.[0]

  return {
    temperature: String(Math.round(current.temp)),
    high: today ? String(Math.round(today.temp_max)) : String(Math.round(current.temp_max)),
    low: today ? String(Math.round(today.temp_min)) : String(Math.round(current.temp_min)),
    condition: current.description,
    icon: conditionIcons[current.condition] ?? '\u2601\uFE0F',
  }
}
