import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeatherStrip } from './WeatherStrip'

const useWeatherData = vi.hoisted(() => vi.fn())
const useWeatherForecast = vi.hoisted(() => vi.fn())
const useAirQuality = vi.hoisted(() => vi.fn())
// `useHeroWeather` composes the other two rather than being a query of its
// own, so it returns the object (or null) directly — see the same note in
// `Masthead.test.tsx`.
const useHeroWeather = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/weather', () => ({
  useWeatherData,
  useWeatherForecast,
  useAirQuality,
  useHeroWeather,
}))

const CURRENT = {
  temp: 91.2,
  feels_like: 89.9,
  temp_min: 85.9,
  temp_max: 94.4,
  humidity: 32,
  condition: 'Clear',
  description: 'clear sky',
  icon: '01d',
  wind_speed: 5.99,
  wind_deg: 338,
  sunrise: 1785503486,
  sunset: 1785554182,
}

const HOURLY = [
  {
    dt: 1785531600,
    temp: 90.99,
    condition: 'Clear',
    description: 'clear sky',
    icon: '01d',
    pop: 0,
    humidity: 33,
  },
  {
    dt: 1785542400,
    temp: 88.47,
    condition: 'Clouds',
    description: 'few clouds',
    icon: '02d',
    pop: 0,
    humidity: 28,
  },
]

const AIR_FULL = {
  aqi: 55,
  aqi_level: 'moderate' as const,
  uv_index: 10.55,
  uv_level: 'very_high' as const,
  pollen: 12,
  pollen_level: 'low' as const,
}

describe('WeatherStrip', () => {
  beforeEach(() => {
    useWeatherData.mockReturnValue({
      data: CURRENT,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    useWeatherForecast.mockReturnValue({
      data: { daily: [], hourly: HOURLY },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    useAirQuality.mockReturnValue({
      data: AIR_FULL,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    // 94/86 rather than CURRENT's own temp_max/temp_min: `useHeroWeather`
    // prefers the forecast's daily figures, and the point of mocking it
    // separately is that this cell renders what that hook decided, not what
    // it might have re-derived from `CURRENT`.
    useHeroWeather.mockReturnValue({
      temperature: '91',
      high: '94',
      low: '86',
      condition: 'clear sky',
      icon: '☀️',
    })
  })

  it('renders with every source empty', () => {
    expect(() => render(<WeatherStrip />)).not.toThrow()
  })

  it('renders nothing when every source is empty, rather than an empty bordered band', () => {
    useWeatherData.mockReturnValue({ data: null, isLoading: false, error: null, refetch: vi.fn() })
    useWeatherForecast.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    useAirQuality.mockReturnValue({ data: null, isLoading: false, error: null, refetch: vi.fn() })
    useHeroWeather.mockReturnValue(null)
    const { container } = render(<WeatherStrip />)
    expect(container.firstChild).toBeNull()
  })

  it('renders all six cells when every source is fully populated', () => {
    render(<WeatherStrip />)
    expect(screen.getByText(/UP/)).toBeInTheDocument()
    expect(screen.getByText(/DOWN/)).toBeInTheDocument()
    expect(screen.getByText('91°')).toBeInTheDocument()
    expect(screen.getByText('88°')).toBeInTheDocument()
    expect(screen.getByText('HIGH · LOW')).toBeInTheDocument()
    expect(screen.getByText(/94°/)).toBeInTheDocument()
    expect(screen.getByText(/86°/)).toBeInTheDocument()
    expect(screen.getByText('55')).toBeInTheDocument()
    expect(screen.getByText('MODERATE')).toBeInTheDocument()
    expect(screen.getByText('UV · POLLEN')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument() // rounded UV
    expect(screen.getByText('LOW')).toBeInTheDocument() // pollen level
    expect(screen.getByText('WIND · HUM')).toBeInTheDocument()
    expect(screen.getByText('32%')).toBeInTheDocument()
  })

  it('drops only the sun cell when current weather has no sunrise/sunset', () => {
    useWeatherData.mockReturnValue({
      data: { ...CURRENT, sunrise: 0, sunset: 0 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<WeatherStrip />)
    expect(screen.queryByText(/UP/)).toBeNull()
    // The hourly cell (an unrelated source) still renders.
    expect(screen.getByText('91°')).toBeInTheDocument()
  })

  it('drops only the hourly cell on an empty forecast', () => {
    useWeatherForecast.mockReturnValue({
      data: { daily: [], hourly: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<WeatherStrip />)
    expect(screen.queryByText('91°')).toBeNull()
    // AQI (an unrelated source) still renders.
    expect(screen.getByText('55')).toBeInTheDocument()
  })

  it('drops only the high/low cell when there is no current reading to derive it from', () => {
    // `useHeroWeather` returns null exactly when `useWeatherData` has no
    // data, so this is the shape a real current-weather outage produces —
    // and the forecast and air-quality cells, on unrelated sources, still
    // render beside the gap.
    useWeatherData.mockReturnValue({ data: null, isLoading: false, error: null, refetch: vi.fn() })
    useHeroWeather.mockReturnValue(null)
    render(<WeatherStrip />)
    expect(screen.queryByText('HIGH · LOW')).toBeNull()
    expect(screen.getByText('91°')).toBeInTheDocument()
    expect(screen.getByText('55')).toBeInTheDocument()
  })

  it('drops only the AQI and UV/pollen cells when the air-quality call fails entirely', () => {
    // The all-null shape the backend returns when Open-Meteo is down and
    // there's no cached reading yet — never an error, per the failure-
    // isolation contract, so this exercises the same null-field path a
    // real outage produces.
    useAirQuality.mockReturnValue({
      data: {
        aqi: null,
        aqi_level: null,
        uv_index: null,
        uv_level: null,
        pollen: null,
        pollen_level: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<WeatherStrip />)
    expect(screen.queryByText('AIR · AQI')).toBeNull()
    expect(screen.queryByText(/UV/)).toBeNull()
    // Sun and hourly (unrelated sources) still render.
    expect(screen.getByText(/UP/)).toBeInTheDocument()
    expect(screen.getByText('91°')).toBeInTheDocument()
  })

  it('shows UV alone, without a pollen segment, when pollen is null but UV is present', () => {
    // The real-world case for this dashboard's US location: Open-Meteo
    // returns AQI and UV but every pollen species is null.
    useAirQuality.mockReturnValue({
      data: {
        aqi: 55,
        aqi_level: 'moderate',
        uv_index: 10.55,
        uv_level: 'very_high',
        pollen: null,
        pollen_level: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<WeatherStrip />)
    expect(screen.getByText('UV INDEX')).toBeInTheDocument()
    expect(screen.queryByText('UV · POLLEN')).toBeNull()
    expect(screen.queryByText('LOW')).toBeNull()
  })

  it('colours the AQI value forest only when the level is good', () => {
    useAirQuality.mockReturnValue({
      data: {
        aqi: 20,
        aqi_level: 'good',
        uv_index: null,
        uv_level: null,
        pollen: null,
        pollen_level: null,
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    render(<WeatherStrip />)
    const value = screen.getByText('20')
    expect(value.parentElement?.style.color).toBe('var(--forest)')
  })
})
