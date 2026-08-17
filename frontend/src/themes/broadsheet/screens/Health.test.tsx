import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Health } from './Health'

const useHealthServices = vi.hoisted(() => vi.fn())
const useServiceUptime = vi.hoisted(() => vi.fn())
const useIncidents = vi.hoisted(() => vi.fn())
const useUptimeWindows = vi.hoisted(() => vi.fn())

vi.mock('@/integrations/health', async () => {
  // The pure helpers come through: they have no transport behind them, and
  // stubbing them would only make the screen agree with the test.
  const summary = await vi.importActual<typeof import('@/integrations/health/summary')>(
    '@/integrations/health/summary',
  )
  const incidents = await vi.importActual<typeof import('@/integrations/health/incidents')>(
    '@/integrations/health/incidents',
  )
  return {
    useHealthServices,
    useServiceUptime,
    useIncidents,
    useUptimeWindows,
    REFRESH_MS: 10_000,
    ...summary,
    ...incidents,
  }
})

const service = (over: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Plex',
  status: 'ok',
  message: null,
  enabled: true,
  type_id: 'http',
  interval_secs: 60,
  updated_at: 1_800_000_000,
  components: [],
  recent_incidents: [],
  ...over,
})

describe('broadsheet Health', () => {
  beforeEach(() => {
    useHealthServices.mockReturnValue({ data: [service()], isLoading: false })
    useServiceUptime.mockReturnValue({})
    useIncidents.mockReturnValue({ data: [], isError: false })
    useUptimeWindows.mockReturnValue([
      { label: '24 hours', pct: 99.96 },
      { label: '7 days', pct: 99.42 },
      { label: '30 days', pct: 99.81 },
    ])
  })

  /**
   * The suite's masthead rule: the centre names or states the page, both ears
   * carry live data, and no ear is a second name. This screen carried
   * "Section VI / The Wire" in the ear and a verdict in the centre ("All
   * quiet.") that the standfirst directly beneath already opens with — the
   * masthead was duplicating its own subhead.
   */
  it('names the page in the centre, with no page-name ear', () => {
    render(<Health />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Health')
    expect(screen.queryByText('The Wire')).not.toBeInTheDocument()
    expect(screen.queryByText(/Section VI/)).not.toBeInTheDocument()
  })

  it('reports uptime over each window in the ear', () => {
    render(<Health />)
    expect(screen.getByText('Uptime')).toBeInTheDocument()
    expect(screen.getByText('99.96%')).toBeInTheDocument()
    expect(screen.getByText('7 days')).toBeInTheDocument()
    expect(screen.getByText('99.42%')).toBeInTheDocument()
    expect(screen.getByText('30 days')).toBeInTheDocument()
  })

  it('marks a window below 99.5% so the number reads as the story', () => {
    render(<Health />)
    // 99.42% is the shortfall; 99.96% is not.
    expect(screen.getByText('99.42%')).toHaveStyle({ color: 'var(--rust)' })
    expect(screen.getByText('99.96%')).toHaveStyle({ color: 'var(--ink)' })
  })

  it('shows a dash rather than a percentage when a window cannot be computed', () => {
    // No monitors: dividing by a fleet of zero is not 100% uptime, it is no
    // answer — see `computeUptimeWindows`.
    useUptimeWindows.mockReturnValue([
      { label: '24 hours', pct: null },
      { label: '7 days', pct: null },
      { label: '30 days', pct: null },
    ])
    render(<Health />)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText(/100\.00%/)).not.toBeInTheDocument()
  })
})
