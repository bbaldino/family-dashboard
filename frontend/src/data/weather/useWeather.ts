import { usePolling } from '@/hooks/usePolling'
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

export const conditionIcons: Record<string, string> = {
  Clear: '☀️',
  Clouds: '☁️',
  Rain: '\u{1F327}️',
  Drizzle: '\u{1F326}️',
  Thunderstorm: '⚡',
  Snow: '❄️',
  Mist: '\u{1F32B}️',
  Fog: '\u{1F32B}️',
  Haze: '\u{1F32B}️',
}

export function useWeatherData() {
  return usePolling<WeatherData>({
    queryKey: ['weather', 'current'],
    fetcher: () => weatherIntegration.api.get<WeatherData>('/current'),
    intervalMs: 15 * 60 * 1000, // 15 minutes
  })
}
