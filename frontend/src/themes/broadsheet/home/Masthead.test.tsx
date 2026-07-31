import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Masthead } from './Masthead'

const useHeroWeather = vi.hoisted(() => vi.fn())
const useWeatherData = vi.hoisted(() => vi.fn())
vi.mock('@/data/weather', () => ({ useHeroWeather, useWeatherData }))

describe('Masthead', () => {
  beforeEach(() => {
    // useHeroWeather returns the HeroWeather object directly (or null) —
    // not a react-query result. See src/data/weather/useHeroWeather.ts.
    useHeroWeather.mockReturnValue({ temperature: '75', high: '78', low: '53', condition: 'Sunny', icon: '01d' })
    // useWeatherData wraps usePolling, which does return a { data, isLoading } shape.
    useWeatherData.mockReturnValue({
      data: { feels_like: 76, humidity: 41, wind_speed: 6 },
      isLoading: false,
    })
  })

  it('shows the temperature and condition', () => {
    render(<Masthead standfirst="Nothing on the calendar — the day is yours." />)
    expect(screen.getByText(/75/)).toBeInTheDocument()
    expect(screen.getByText(/Sunny/)).toBeInTheDocument()
  })

  it('renders the standfirst prose', () => {
    render(<Masthead standfirst="One thing today: Pick up kids." />)
    expect(screen.getByText('One thing today: Pick up kids.')).toBeInTheDocument()
  })

  it('renders without weather rather than crashing', () => {
    useHeroWeather.mockReturnValue(null)
    useWeatherData.mockReturnValue({ data: null, isLoading: true })
    render(<Masthead standfirst="A quiet day." />)
    expect(screen.getByText('A quiet day.')).toBeInTheDocument()
  })
})
