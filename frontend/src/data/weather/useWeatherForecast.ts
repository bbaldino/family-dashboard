import { usePolling } from '@/hooks/usePolling'
import { weatherIntegration } from './config'

export interface ForecastDay {
  date: string
  temp_max: number
  temp_min: number
}

/** One 3-hour step from OpenWeather's free `/forecast` endpoint — the
 *  backend takes the next 8 entries (24 hours) as-is. Not hourly, despite
 *  the name of the endpoint that carries it; the strip that renders these
 *  labels each point's actual time rather than implying a resolution the
 *  free tier doesn't have. */
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

export function useWeatherForecast() {
  return usePolling<ForecastData>({
    queryKey: ['weather', 'forecast'],
    fetcher: () => weatherIntegration.api.get<ForecastData>('/forecast'),
    intervalMs: 30 * 60 * 1000, // 30 minutes
  })
}
