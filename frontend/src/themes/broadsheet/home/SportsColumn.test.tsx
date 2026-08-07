import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SportsColumn } from './SportsColumn'
import type { GamesResponse, GameState } from '@/integrations/sports'

const useSportsPreview = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/sports', async () => {
  // `scoreboardIsDown`/`formatUnavailableLeagues` are pure and have no
  // transport behind them, so the real ones come through rather than being
  // stubbed into agreeing with whatever the test expects.
  const degraded = await vi.importActual<typeof import('@/integrations/sports/degraded')>(
    '@/integrations/sports/degraded',
  )
  return { useSportsPreview, formatUpcomingTime: (s: string) => s, ...degraded }
})

const team = (abbreviation: string, score: number | null) => ({
  id: abbreviation,
  name: abbreviation,
  abbreviation,
  logo: '',
  record: '31-19',
  score,
  winner: null,
  color: '005A9C',
  altColor: 'ffffff',
  hits: 7,
  errors: 0,
})

// Real GameState values are 'live' | 'final' | 'upcoming' | 'postponed' — the
// task brief's mock used 'pre'/'in', which don't exist on the wire. Corrected
// here (see src/integrations/sports/types.ts).
const game = (state: GameState, extra: Record<string, unknown> = {}) => ({
  id: 'g1',
  league: 'MLB',
  state,
  name: 'LAD @ MIL',
  startTime: '2026-05-22T16:40:00-07:00',
  venue: null,
  broadcast: 'MLB.TV',
  playoffRound: null,
  home: team('MIL', state === 'upcoming' ? null : 3),
  away: team('LAD', state === 'upcoming' ? null : 4),
  clock: null,
  period: 7,
  periodLabel: 'BOT 7',
  leaders: [],
  allLeaders: [],
  situation: null,
  lastPlay: null,
  headline: null,
  linescores: [],
  athletes: [],
  espnUrl: null,
  liveDetail: null,
  ...extra,
})

describe('SportsColumn', () => {
  beforeEach(() => {
    useSportsPreview.mockReturnValue({ data: undefined })
  })

  it('shows the off-day block when there is no game', () => {
    const data: GamesResponse = { games: [], hasLive: false, unavailableLeagues: [] }
    render(<SportsColumn data={data} isLoading={false} />)
    expect(screen.getByText(/no game|off day|dark/i)).toBeInTheDocument()
  })

  it('shows the pregame block for a scheduled game', () => {
    const data: GamesResponse = {
      games: [game('upcoming')],
      hasLive: false,
      unavailableLeagues: [],
    }
    render(<SportsColumn data={data} isLoading={false} />)
    // The fixture's team() helper sets `name === abbreviation`, so "LAD"
    // legitimately appears more than once (the team cap and the full-name
    // label render separately) — real ESPN data never collides like this.
    expect(screen.getAllByText('LAD').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MIL').length).toBeGreaterThan(0)
  })

  it('shows the score for a live game', () => {
    const data: GamesResponse = { games: [game('live')], hasLive: true, unavailableLeagues: [] }
    render(<SportsColumn data={data} isLoading={false} />)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('renders a live game with no situation or liveDetail', () => {
    const data: GamesResponse = {
      games: [game('live', { situation: null, liveDetail: null })],
      hasLive: true,
      unavailableLeagues: [],
    }
    expect(() => render(<SportsColumn data={data} isLoading={false} />)).not.toThrow()
  })

  it('renders while sports data is loading', () => {
    expect(() => render(<SportsColumn data={undefined} isLoading={true} />)).not.toThrow()
  })
})
