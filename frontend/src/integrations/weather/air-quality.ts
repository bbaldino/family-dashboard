/**
 * AQI/UV/pollen banding ported from
 * `backend/src/integrations/weather/air_quality.rs` (~330 lines) — domain
 * logic that exists in both schemes, just in a different language, so this
 * file is a relocation, not a saving. The Rust file's `AirQualityCache` and
 * `OpenMeteo*` deserialisation structs genuinely do disappear: the fetch
 * proxy's response cache (`ttlSecs: 1800`, passed by `useAirQuality` in
 * `weather.ts`) replaces the cache, and TypeScript's structural typing
 * replaces the deserialisation structs.
 */

/** Qualitative bands, ported from the Rust `aqi_level`/`uv_level`/
 *  `pollen_level` functions. Slugs, not display words — the strip that
 *  consumes these maps them to the tight mono labels the design calls for
 *  ("GOOD", "V.HIGH", …). */
export type AqiLevel =
  'good' | 'moderate' | 'unhealthy_sensitive' | 'unhealthy' | 'very_unhealthy' | 'hazardous'
export type UvLevel = 'low' | 'moderate' | 'high' | 'very_high' | 'extreme'
export type PollenLevel = 'none' | 'low' | 'moderate' | 'high' | 'very_high'

/** `POST /api/fetch/weather/air` (Open-Meteo, no key). Every field is
 *  independently nullable: pollen is `null` for any US location
 *  (Open-Meteo's pollen coverage is Europe-only) even when AQI and UV are
 *  populated, and the whole object can be all-null if the upstream field is
 *  missing from the response entirely. */
export interface AirQualityData {
  aqi: number | null
  aqi_level: AqiLevel | null
  uv_index: number | null
  uv_level: UvLevel | null
  pollen: number | null
  pollen_level: PollenLevel | null
}

/** The subset of Open-Meteo's `current` block `airQualityUrl` in `weather.ts`
 *  requests — an index signature admits the rest of the live payload
 *  (`time`, `interval`, …) without narrowing what we read from it. */
interface OpenMeteoAirCurrent {
  us_aqi?: number | null
  uv_index?: number | null
  alder_pollen?: number | null
  birch_pollen?: number | null
  grass_pollen?: number | null
  mugwort_pollen?: number | null
  olive_pollen?: number | null
  ragweed_pollen?: number | null
  [key: string]: unknown
}

interface OpenMeteoAirResponse {
  current?: OpenMeteoAirCurrent
  [key: string]: unknown
}

/** US EPA AQI bands (https://www.airnow.gov/aqi/aqi-basics/), 0-500 scale.
 *  Port of `air_quality.rs`'s `aqi_level`. */
function aqiLevel(aqi: number): AqiLevel {
  if (aqi <= 50) return 'good'
  if (aqi <= 100) return 'moderate'
  if (aqi <= 150) return 'unhealthy_sensitive'
  if (aqi <= 200) return 'unhealthy'
  if (aqi <= 300) return 'very_unhealthy'
  return 'hazardous'
}

/** WHO/EPA UV index bands (https://www.epa.gov/sunsafety/uv-index-scale-0).
 *  Port of `air_quality.rs`'s `uv_level`. */
function uvLevel(uv: number): UvLevel {
  if (uv < 3.0) return 'low'
  if (uv < 6.0) return 'moderate'
  if (uv < 8.0) return 'high'
  if (uv < 11.0) return 'very_high'
  return 'extreme'
}

/** Pollen has no single published cross-species scale — see
 *  `air_quality.rs`'s doc comment for why. Buckets the max reading across
 *  species against the UK Met Office's grass-pollen scale as a
 *  general-purpose approximation: none / low / moderate / high / very-high
 *  at 0 / 30 / 50 / 150 grains/m3. Port of `air_quality.rs`'s
 *  `pollen_level`. */
function pollenLevel(maxGrains: number): PollenLevel {
  if (maxGrains <= 0.0) return 'none'
  if (maxGrains <= 30.0) return 'low'
  if (maxGrains <= 50.0) return 'moderate'
  if (maxGrains <= 150.0) return 'high'
  return 'very_high'
}

/** Port of `air_quality.rs`'s `reshape`. */
export function computeAirQuality(raw: OpenMeteoAirResponse): AirQualityData {
  const current = raw.current ?? {}

  const aqi = current.us_aqi != null ? Math.round(current.us_aqi) : null
  const uv = current.uv_index ?? null

  // Max across species, ignoring absent ones — `null` only when every
  // species is missing (the US case, always).
  const pollenMax = [
    current.alder_pollen,
    current.birch_pollen,
    current.grass_pollen,
    current.mugwort_pollen,
    current.olive_pollen,
    current.ragweed_pollen,
  ].reduce<number | null>((max, value) => {
    if (value == null) return max
    return max == null ? value : Math.max(max, value)
  }, null)

  return {
    aqi,
    aqi_level: aqi != null ? aqiLevel(aqi) : null,
    uv_index: uv,
    uv_level: uv != null ? uvLevel(uv) : null,
    pollen: pollenMax,
    pollen_level: pollenMax != null ? pollenLevel(pollenMax) : null,
  }
}
