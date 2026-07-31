import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Masthead } from './Masthead'
import { ordinalSuffix } from './ordinal'

const useHeroWeather = vi.hoisted(() => vi.fn())
vi.mock('@/data/weather', () => ({ useHeroWeather }))

function renderMasthead(overrides: Partial<Parameters<typeof Masthead>[0]> = {}) {
  return render(
    <Masthead
      standfirst="Nothing on the calendar — the day is yours."
      isLive={false}
      nextEventSummary="Tomorrow first"
      totalEvents={0}
      {...overrides}
    />,
  )
}

describe('Masthead', () => {
  beforeEach(() => {
    // useHeroWeather returns the HeroWeather object directly (or null) —
    // not a react-query result. See src/data/weather/useHeroWeather.ts.
    useHeroWeather.mockReturnValue({ temperature: '75', high: '78', low: '53', condition: 'Sunny', icon: '☀️' })
  })

  it('shows the temperature and condition', () => {
    renderMasthead()
    expect(screen.getByText(/75/)).toBeInTheDocument()
    expect(screen.getByText(/sunny/)).toBeInTheDocument()
  })

  it('shows a restrained high/low beneath the temperature', () => {
    renderMasthead()
    expect(screen.getByText(/78°/)).toBeInTheDocument()
    expect(screen.getByText(/53°/)).toBeInTheDocument()
  })

  it('renders the standfirst prose', () => {
    renderMasthead({ standfirst: 'One thing today: Pick up kids.' })
    expect(screen.getByText(/One thing today: Pick up kids\./)).toBeInTheDocument()
  })

  it('renders the standfirst summary — next event and total events', () => {
    renderMasthead({ nextEventSummary: 'Next in 1h 43m', totalEvents: 12 })
    expect(screen.getByText(/Next in 1h 43m/)).toBeInTheDocument()
    expect(screen.getByText(/12 events \/ 7 days/)).toBeInTheDocument()
  })

  it('renders without weather rather than crashing', () => {
    useHeroWeather.mockReturnValue(null)
    renderMasthead({ standfirst: 'A quiet day.' })
    expect(screen.getByText(/A quiet day\./)).toBeInTheDocument()
  })

  it('does not render a "Kitchen Dashboard" wordmark', () => {
    // The Phase 4 plan invented a wordmark for the centre cell; the mock
    // never had one — the date is the centrepiece instead.
    renderMasthead()
    expect(screen.queryByText(/Kitchen Dashboard/)).not.toBeInTheDocument()
  })

  it("renders today's date with a correct ordinal suffix", () => {
    renderMasthead()
    const day = new Date().getDate()
    const suffix = ordinalSuffix(day)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading.textContent).toContain(`${day}${suffix}`)
  })

  it('shows the live-game indicator only when a game is live', () => {
    const { rerender } = renderMasthead({ isLive: false })
    expect(screen.queryByText(/LIVE GAME/)).not.toBeInTheDocument()

    rerender(
      <Masthead
        standfirst="Nothing on the calendar — the day is yours."
        isLive={true}
        nextEventSummary="Tomorrow first"
        totalEvents={0}
      />,
    )
    expect(screen.getByText(/LIVE GAME/)).toBeInTheDocument()
  })
})
