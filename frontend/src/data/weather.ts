import { z } from 'zod'
import { defineIntegration } from '@/data/define-integration'
import { useIntegrationData } from '@/platform'
import { summariseForecast } from './weather/forecast'
import { computeAirQuality } from './weather/air-quality'
import type { AqiLevel, UvLevel, PollenLevel, AirQualityData } from './weather/air-quality'
import type { ForecastDay, ForecastData, HourlyForecast } from './weather/forecast'

/**
 * Weather — replaces the five old files under `data/weather/` (config,
 * index, useWeather, useWeatherForecast, useHeroWeather, useAirQuality) plus
 * `backend/src/integrations/weather/routes.rs` and `air_quality.rs`'s
 * fetch/cache plumbing. `forecast.ts` and `air-quality.ts` carry the real
 * domain logic (daily bucketing, AQI/UV/pollen banding) that was ported, not
 * saved — see those files' own headers.
 *
 * `weatherIntegration` still needs `schema`/`fields`: it's registered in the
 * admin settings UI (`data/integrations-registry.ts`), which requires
 * `@/data/define-integration`'s config-schema `defineIntegration`, not the
 * platform's simpler `{id, name}` one. `PlatformIntegration` is structurally
 * just `{id, name}`, and this object has both (plus `schema`/`fields`/`api`,
 * which `useIntegrationData`/`useIntegrationQuery` ignore) — passing it
 * straight through typechecks because TypeScript only excess-property checks
 * object *literals*, not variables, so no second `defineIntegration` object
 * was needed for the platform's world.
 */
export const weatherIntegration = defineIntegration({
  id: 'weather',
  name: 'Weather',
  schema: z.object({
    api_key: z.string().min(1, 'API key is required'),
    lat: z.string().min(1).default('37.2504'),
    lon: z.string().min(1).default('-121.9000'),
  }),
  fields: {
    api_key: { label: 'OpenWeatherMap API Key', type: 'secret' },
    lat: { label: 'Latitude' },
    lon: { label: 'Longitude' },
  },
})

/**
 * Air quality (Open-Meteo) needs no API key — only coordinates, which
 * already default. Gating `useAirQuality` on `weatherIntegration`'s full
 * schema (which requires `api_key`) would silently disable AQI/UV/pollen on
 * any install that hasn't configured an OpenWeatherMap key, even though
 * nothing about the Open-Meteo call needs one: `useIntegrationConfig` would
 * return `null` for the whole thing, the URL would be `null`, and the query
 * would just be disabled with no error state to notice by. Same `id` as
 * `weatherIntegration` — it reads the same `weather.*` config keys, just
 * validated against a narrower schema.
 */
const weatherCoordsIntegration = defineIntegration({
  id: 'weather',
  name: 'Weather',
  schema: z.object({
    lat: z.string().min(1).default('37.2504'),
    lon: z.string().min(1).default('-121.9000'),
  }),
  fields: {
    lat: { label: 'Latitude' },
    lon: { label: 'Longitude' },
  },
})

type WeatherConfig = z.infer<typeof weatherIntegration.schema>
type WeatherCoords = z.infer<typeof weatherCoordsIntegration.schema>

function openWeatherUrl(path: string, cfg: WeatherConfig): string {
  const q = new URLSearchParams({
    lat: cfg.lat,
    lon: cfg.lon,
    appid: cfg.api_key,
    units: 'imperial',
  })
  return `https://api.openweathermap.org/data/2.5/${path}?${q}`
}

/** Open-Meteo needs no key and spells the coordinates differently. */
function airQualityUrl(cfg: WeatherCoords): string {
  const q = new URLSearchParams({
    latitude: cfg.lat,
    longitude: cfg.lon,
    // Byte-identical to what the deleted manifest declared. US AQI, not
    // European — `air-quality.ts` bands on the US scale (50/100/150/200/300),
    // so swapping this produces plausible but wrong readings.
    current:
      'us_aqi,uv_index,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen',
  })
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${q}`
}

/* ─────────── current ─────────── */

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
  /** Degrees, meteorological convention (0 = N). */
  wind_deg: number
  /** Unix seconds, UTC — OpenWeather's `sys.sunrise`/`sys.sunset`. */
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

/** The raw OpenWeather `/data/2.5/weather` shape — `/api/fetch` relays
 *  upstream JSON verbatim, so reshaping into `WeatherData` is this hook's
 *  job now, not the Rust route's. */
interface OpenWeatherCurrentResponse {
  main: {
    temp: number
    feels_like: number
    temp_min: number
    temp_max: number
    humidity: number
  }
  weather: { main: string; description: string; icon: string }[]
  wind: { speed: number; deg: number }
  sys: { sunrise: number; sunset: number }
}

export function useWeatherData() {
  // Explicit `<Raw, Out>` type args here would leave `T` unfilled (TS does
  // not infer the remainder of a partially-supplied type argument list, so
  // it would fall back to `T`'s `never` default and fail to match
  // `weatherIntegration`'s schema) — annotate `select`'s parameter instead
  // and let everything infer from the arguments.
  return useIntegrationData(
    weatherIntegration,
    (cfg) => ({
      url: openWeatherUrl('weather', cfg),
      ttlSecs: 600,
    }),
    {
      select: (d: OpenWeatherCurrentResponse): WeatherData => ({
        temp: d.main.temp,
        feels_like: d.main.feels_like,
        temp_min: d.main.temp_min,
        temp_max: d.main.temp_max,
        humidity: d.main.humidity,
        condition: d.weather[0].main,
        description: d.weather[0].description,
        icon: d.weather[0].icon,
        wind_speed: d.wind.speed,
        wind_deg: d.wind.deg,
        sunrise: d.sys.sunrise,
        sunset: d.sys.sunset,
      }),
      refetchInterval: 15 * 60 * 1000,
    },
  )
}

/* ─────────── forecast ─────────── */

export type { ForecastDay, ForecastData, HourlyForecast }

export function useWeatherForecast() {
  return useIntegrationData(
    weatherIntegration,
    (cfg) => ({
      url: openWeatherUrl('forecast', cfg),
      ttlSecs: 900,
    }),
    {
      select: summariseForecast,
      refetchInterval: 30 * 60 * 1000,
    },
  )
}

/* ─────────── air quality ─────────── */

export type { AqiLevel, UvLevel, PollenLevel, AirQualityData }

export function useAirQuality() {
  return useIntegrationData(
    weatherCoordsIntegration,
    (cfg) => ({
      url: airQualityUrl(cfg),
      ttlSecs: 1800,
    }),
    {
      select: computeAirQuality,
      refetchInterval: 30 * 60 * 1000,
    },
  )
}

/* ─────────── derived ─────────── */

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
