import { describe, expect, it, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useAirQuality, useWeatherData, useWeatherForecast } from './weather'

/**
 * Pins the URLs `weather.ts` composes from config against the deleted
 * manifest's values — nothing else in the suite sees these strings.
 * `forecast.test.ts`/`air-quality.test.ts` only exercise the pure reshape
 * functions, which never see a URL, so a swapped host, a `lat`/`latitude`
 * mix-up, or (worst) `us_aqi` silently becoming `european_aqi` would ship
 * with a green suite otherwise — wrong-but-plausible numbers on a wall
 * display instead of an error.
 */

const FULL_CONFIG = {
  'weather.api_key': 'test-key',
  'weather.lat': '37.2504',
  'weather.lon': '-121.9000',
}

/** No `weather.api_key` — the shape of an install that has only ever set
 *  coordinates (or never touched weather config; `lat`/`lon` default). */
const COORDS_ONLY_CONFIG = {
  'weather.lat': '37.2504',
  'weather.lon': '-121.9000',
}

const WEATHER_CURRENT_PAYLOAD = {
  main: { temp: 70, feels_like: 68, temp_min: 60, temp_max: 80, humidity: 50 },
  weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
  wind: { speed: 5, deg: 180 },
  sys: { sunrise: 1000, sunset: 2000 },
}

const FORECAST_PAYLOAD = { list: [] }

const AIR_QUALITY_PAYLOAD = { current: { us_aqi: 42, uv_index: 3 } }

function stubFetch(config: Record<string, string>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/config') {
      return { ok: true, json: async () => config } as Response
    }
    if (url === '/api/fetch') {
      const body = JSON.parse(init!.body as string) as { url: string; ttl_secs: number }
      let payload: unknown
      if (body.url.includes('/data/2.5/weather')) {
        payload = WEATHER_CURRENT_PAYLOAD
      } else if (body.url.includes('/data/2.5/forecast')) {
        payload = FORECAST_PAYLOAD
      } else if (body.url.includes('air-quality-api.open-meteo.com')) {
        payload = AIR_QUALITY_PAYLOAD
      } else {
        throw new Error(`Unexpected upstream url in body: ${body.url}`)
      }
      return { ok: true, text: async () => JSON.stringify(payload) } as Response
    }
    throw new Error(`Unexpected fetch url: ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('weather URL construction', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('composes the OpenWeatherMap current-weather URL and ttlSecs exactly', async () => {
    const fetchMock = stubFetch(FULL_CONFIG)
    const { result } = renderHook(() => useWeatherData(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const call = fetchMock.mock.calls.find(([input]) => String(input) === '/api/fetch')
    expect(call).toBeDefined()
    const [, init] = call!
    expect(JSON.parse(init!.body as string)).toEqual({
      url: 'https://api.openweathermap.org/data/2.5/weather?lat=37.2504&lon=-121.9000&appid=test-key&units=imperial',
      ttl_secs: 600,
    })
  })

  it('composes the OpenWeatherMap forecast URL and ttlSecs exactly', async () => {
    const fetchMock = stubFetch(FULL_CONFIG)
    const { result } = renderHook(() => useWeatherForecast(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const call = fetchMock.mock.calls.find(([input]) => String(input) === '/api/fetch')
    expect(call).toBeDefined()
    const [, init] = call!
    expect(JSON.parse(init!.body as string)).toEqual({
      url: 'https://api.openweathermap.org/data/2.5/forecast?lat=37.2504&lon=-121.9000&appid=test-key&units=imperial',
      ttl_secs: 900,
    })
  })

  it('composes the Open-Meteo air-quality URL and ttlSecs exactly, including the byte-identical `current` param', async () => {
    const fetchMock = stubFetch(FULL_CONFIG)
    const { result } = renderHook(() => useAirQuality(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const call = fetchMock.mock.calls.find(([input]) => String(input) === '/api/fetch')
    expect(call).toBeDefined()
    const [, init] = call!
    expect(JSON.parse(init!.body as string)).toEqual({
      url: 'https://air-quality-api.open-meteo.com/v1/air-quality?latitude=37.2504&longitude=-121.9000&current=us_aqi%2Cuv_index%2Calder_pollen%2Cbirch_pollen%2Cgrass_pollen%2Cmugwort_pollen%2Colive_pollen%2Cragweed_pollen',
      ttl_secs: 1800,
    })
  })

  it('fetches air quality with only coordinates configured, no OpenWeatherMap api_key required', async () => {
    const fetchMock = stubFetch(COORDS_ONLY_CONFIG)
    const { result } = renderHook(() => useAirQuality(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.data).toBeDefined())

    const call = fetchMock.mock.calls.find(([input]) => String(input) === '/api/fetch')
    expect(call).toBeDefined()
    const [, init] = call!
    expect(JSON.parse(init!.body as string).url).toContain('air-quality-api.open-meteo.com')
  })

  it('keeps the two OpenWeatherMap hooks disabled without an api_key, even though air quality fetches', async () => {
    const fetchMock = stubFetch(COORDS_ONLY_CONFIG)
    const wrapper = createWrapper()

    const { result: air } = renderHook(() => useAirQuality(), { wrapper })
    const { result: current } = renderHook(() => useWeatherData(), { wrapper })
    const { result: forecast } = renderHook(() => useWeatherForecast(), { wrapper })

    await waitFor(() => expect(air.current.data).toBeDefined())

    // The OpenWeatherMap-backed hooks never got a URL (config didn't parse
    // without api_key), so their queries stayed disabled throughout.
    expect(current.current.fetchStatus).toBe('idle')
    expect(forecast.current.fetchStatus).toBe('idle')

    const upstreamUrls = fetchMock.mock.calls
      .filter(([input]) => String(input) === '/api/fetch')
      .map(([, init]) => (JSON.parse(init!.body as string) as { url: string }).url)
    expect(upstreamUrls.every((u) => u.includes('open-meteo.com'))).toBe(true)
    expect(upstreamUrls.some((u) => u.includes('openweathermap.org'))).toBe(false)
  })
})
