import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Masthead } from './Masthead'
import { ordinalSuffix } from './ordinal'

const useHeroWeather = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/weather', () => ({ useHeroWeather }))

function renderMasthead(overrides: Partial<Parameters<typeof Masthead>[0]> = {}) {
  return render(
    <Masthead
      standfirst="Nothing on the calendar — the day is yours."
      nextEventSummary="Tomorrow first"
      totalEvents={0}
      {...overrides}
    />,
  )
}

describe('Masthead', () => {
  beforeEach(() => {
    // useHeroWeather returns the HeroWeather object directly (or null) —
    // not a react-query result. See src/integrations/weather.ts.
    useHeroWeather.mockReturnValue({
      temperature: '75',
      high: '78',
      low: '53',
      condition: 'Sunny',
      icon: '☀️',
    })
  })

  it('shows the temperature and condition', () => {
    renderMasthead()
    expect(screen.getByText(/75/)).toBeInTheDocument()
    expect(screen.getByText(/sunny/)).toBeInTheDocument()
  })

  it('leaves the high/low to the weather strip', () => {
    // It used to render here, as a full-width line below the three-column
    // grid, and that row was the masthead's excess height: two numbers for
    // a whole line of vertical space at the top of the screen. `78`/`53`
    // are deliberately distinct from the `75` current temperature, so this
    // fails if the line comes back rather than matching it by accident.
    renderMasthead()
    expect(screen.queryByText(/78°/)).not.toBeInTheDocument()
    expect(screen.queryByText(/53°/)).not.toBeInTheDocument()
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

  it('does not render a live-game indicator — the mock removed the weather kicker that carried it', () => {
    // The masthead's "Outside" kicker (and the "● LIVE GAME" indicator that
    // lived inside it) was removed entirely, not hidden. Live-game state
    // still surfaces elsewhere on Home — the sports column — just not here.
    renderMasthead()
    expect(screen.queryByText(/LIVE GAME/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Outside/)).not.toBeInTheDocument()
  })
})
