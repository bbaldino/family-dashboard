import { conditionIcons, useWeatherData } from './useWeather'
import { useWeatherForecast } from './useWeatherForecast'

export interface HeroWeather {
  temperature: string
  high: string
  low: string
  condition: string
  icon: string
}

// For HeroStrip — returns simplified weather info with daily high/low from forecast
export function useHeroWeather(): HeroWeather | null {
  const { data: current } = useWeatherData()
  const { data: forecast } = useWeatherForecast()

  if (!current) return null

  const today = forecast?.daily?.[0]

  return {
    temperature: String(Math.round(current.temp)),
    high: today ? String(Math.round(today.temp_max)) : String(Math.round(current.temp_max)),
    low: today ? String(Math.round(today.temp_min)) : String(Math.round(current.temp_min)),
    condition: current.description,
    icon: conditionIcons[current.condition] ?? '☁️',
  }
}
