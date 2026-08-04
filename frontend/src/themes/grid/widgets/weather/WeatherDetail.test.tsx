import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeatherDetail } from './WeatherDetail'

const useWeatherForecast = vi.hoisted(() => vi.fn())
vi.mock('@/data/weather', () => ({ useWeatherForecast }))

const FORECAST = {
  daily: [
    {
      date: '2026-08-04',
      temp_max: 93,
      temp_min: 58,
      humidity: 40,
      pop: 0,
      condition: 'Clear',
      description: 'clear sky',
      icon: '01d',
    },
  ],
  hourly: [
    {
      dt: 1785828646,
      temp: 64,
      condition: 'Clear',
      description: 'clear sky',
      icon: '01d',
      pop: 0,
      humidity: 72,
    },
  ],
}

describe('WeatherDetail', () => {
  beforeEach(() => {
    useWeatherForecast.mockReturnValue({ data: FORECAST, isLoading: false, isError: false })
  })

  it('renders the forecast when data is present', () => {
    render(<WeatherDetail />)
    expect(screen.getByText('Next 24 Hours')).toBeInTheDocument()
    expect(screen.getByText('5-Day Forecast')).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('shows the loading state while the first fetch is in flight', () => {
    useWeatherForecast.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<WeatherDetail />)
    expect(screen.getByText('Loading forecast...')).toBeInTheDocument()
    expect(screen.queryByText('Next 24 Hours')).not.toBeInTheDocument()
  })

  it('shows the error state when there is no data to fall back on', () => {
    useWeatherForecast.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<WeatherDetail />)
    expect(screen.getByText('Failed to load forecast')).toBeInTheDocument()
  })

  it('keeps showing the last-good forecast through a failed background poll, rather than an error banner', () => {
    // The regression case: useWeatherForecast() polls every 30 minutes, and
    // react-query's error state does not clear a previous success's `data` —
    // a transient failed refetch must not blank out a forecast the user is
    // currently looking at.
    useWeatherForecast.mockReturnValue({ data: FORECAST, isLoading: false, isError: true })
    render(<WeatherDetail />)
    expect(screen.getByText('Next 24 Hours')).toBeInTheDocument()
    expect(screen.queryByText('Failed to load forecast')).not.toBeInTheDocument()
  })
})
