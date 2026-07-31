import { usePolling } from '@/hooks/usePolling'
import { weatherIntegration } from './config'

export interface ForecastDay {
  date: string
  temp_max: number
  temp_min: number
}

export interface ForecastData {
  daily: ForecastDay[]
}

export function useWeatherForecast() {
  return usePolling<ForecastData>({
    queryKey: ['weather', 'forecast'],
    fetcher: () => weatherIntegration.api.get<ForecastData>('/forecast'),
    intervalMs: 30 * 60 * 1000, // 30 minutes
  })
}
