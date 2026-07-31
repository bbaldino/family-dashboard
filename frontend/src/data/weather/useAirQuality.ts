import { usePolling } from '@/hooks/usePolling'
import { weatherIntegration } from './config'

/** Qualitative bands the backend derives server-side (`AqiLevel`, `UvLevel`,
 *  a pollen-scale approximation — see `backend/src/integrations/weather/
 *  air_quality.rs`) so the thresholds live in one place. Slugs, not display
 *  words — the strip maps these to the tight mono labels the design calls
 *  for ("GOOD", "V.HIGH", …). */
export type AqiLevel = 'good' | 'moderate' | 'unhealthy_sensitive' | 'unhealthy' | 'very_unhealthy' | 'hazardous'
export type UvLevel = 'low' | 'moderate' | 'high' | 'very_high' | 'extreme'
export type PollenLevel = 'none' | 'low' | 'moderate' | 'high' | 'very_high'

/** `GET /api/weather/air` (Open-Meteo, no key). Every field is independently
 *  nullable: pollen is `null` for any US location (Open-Meteo's pollen
 *  coverage is Europe-only) even when AQI and UV are populated, and the
 *  whole object can be all-null if Open-Meteo is unreachable and there's no
 *  cached reading yet (cold cache) — the backend never errors this route,
 *  so a slow/dead third party degrades to nulls rather than a fetch
 *  failure. */
export interface AirQualityData {
  aqi: number | null
  aqi_level: AqiLevel | null
  uv_index: number | null
  uv_level: UvLevel | null
  pollen: number | null
  pollen_level: PollenLevel | null
}

export function useAirQuality() {
  return usePolling<AirQualityData>({
    queryKey: ['weather', 'air'],
    fetcher: () => weatherIntegration.api.get<AirQualityData>('/air'),
    intervalMs: 15 * 60 * 1000, // 15 minutes — matches the backend's own cache TTL
  })
}
