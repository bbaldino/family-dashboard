import { useHaEntity } from '@/hooks/useHaEntity'
import { WidgetCard } from '@/ui/WidgetCard'
import { WeatherDetail } from './WeatherDetail'

const conditionLabels: Record<string, string> = {
  'clear-night': 'Clear',
  cloudy: 'Cloudy',
  fog: 'Foggy',
  hail: 'Hail',
  lightning: 'Thunderstorm',
  'lightning-rainy': 'Thunderstorm',
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

export interface WeatherData {
  temperature: string
  condition: string
  icon: string
  humidity?: number
  forecast?: Array<{
    datetime: string
    temperature: number
    condition: string
  }>
}

export function useWeatherData(): WeatherData | null {
  const entity = useHaEntity('weather.home')

  if (!entity) return null

  const state = entity.state as string
  const attrs = entity.attributes as Record<string, unknown>

  return {
    temperature: String(attrs.temperature ?? '--'),
    condition: conditionLabels[state] ?? state,
    icon: conditionIcons[state] ?? '\u2601\uFE0F',
    humidity: attrs.humidity as number | undefined,
    forecast: attrs.forecast as WeatherData['forecast'],
  }
}

export function WeatherWidget() {
  const weather = useWeatherData()

  if (!weather) return null

  return (
    <WidgetCard
      title="Weather"
      category="info"
      detail={weather.forecast ? <WeatherDetail weather={weather} /> : undefined}
    >
      <div className="flex items-center gap-3">
        <span className="text-[36px]">{weather.icon}</span>
        <div>
          <div className="text-[28px] font-light leading-none text-text-primary">
            {weather.temperature}&deg;
          </div>
          <div className="text-[13px] text-text-secondary">{weather.condition}</div>
          {weather.humidity != null && (
            <div className="text-[11px] text-text-muted">{weather.humidity}% humidity</div>
          )}
        </div>
      </div>
    </WidgetCard>
  )
}
