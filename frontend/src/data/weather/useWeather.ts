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
  /** Degrees, meteorological convention (0 = N) — the backend already
   *  returns this (`wind_deg`); it just had no consumer before the strip's
   *  wind/humidity cell needed a compass direction. */
  wind_deg: number
  /** Unix seconds, UTC — OpenWeather's `sys.sunrise`/`sys.sunset`, passed
   *  through by the backend rather than dropped during reshape. */
  sunrise: number
  sunset: number
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
