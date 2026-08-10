import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SportsColumn } from './SportsColumn'
import type { GamesResponse, GameState } from '@/integrations/sports'

const useSportsPreview = vi.hoisted(() => vi.fn())
const useSportsFinalRecap = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/sports', async () => {
  // `scoreboardIsDown`/`formatUnavailableLeagues` are pure and have no
  // transport behind them, so the real ones come through rather than being
  // stubbed into agreeing with whatever the test expects. `formatFinalDate`
  // is pure for the same reason — and `FinalReport` calls it, so leaving it
  // out of this factory breaks every test in the file the moment the strip
  // renders, not just the ones that assert on a date.
  const degraded = await vi.importActual<typeof import('@/integrations/sports/degraded')>(
    '@/integrations/sports/degraded',
  )
  const formatTime = await vi.importActual<typeof import('@/integrations/sports/formatTime')>(
    '@/integrations/sports/formatTime',
  )
  return {
    useSportsPreview,
    useSportsFinalRecap,
    formatUpcomingTime: (s: string) => s,
    formatFinalDate: formatTime.formatFinalDate,
    ...degraded,
  }
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
    useSportsFinalRecap.mockReturnValue({ data: undefined, isLoading: false, error: null })
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

describe('the prior-game final report', () => {
  const finished = game('final', { id: 'yesterday', startTime: '2026-08-09T20:10:00Z' })

  beforeEach(() => {
    useSportsPreview.mockReturnValue({ data: undefined })
    useSportsFinalRecap.mockReturnValue({ data: undefined, isLoading: false, error: null })
  })

  it('appears beneath a scheduled game', () => {
    const data: GamesResponse = {
      games: [game('upcoming'), finished],
      hasLive: false,
      unavailableLeagues: [],
    }
    render(<SportsColumn data={data} isLoading={false} />)
    expect(screen.getByText(/Final ·/)).toBeInTheDocument()
    // …and the pregame block still leads.
    expect(screen.getAllByText('MIL').length).toBeGreaterThan(0)
  })

  // The "or the next game had started" half of the rule: once the next game
  // is under way it takes the column whole, and the strip drops out on its
  // own. No timer, no clock arithmetic.
  it('does not appear during a live game', () => {
    const data: GamesResponse = {
      games: [game('live'), finished],
      hasLive: true,
      unavailableLeagues: [],
    }
    render(<SportsColumn data={data} isLoading={false} />)
    expect(screen.queryByText(/Final ·/)).toBeNull()
  })

  // Why the lead order gained a rung: with only a finished game, the column
  // used to report "No game today." with the contradicting evidence sitting
  // directly beneath it.
  it('leads the column when there is nothing live or upcoming', () => {
    const data: GamesResponse = { games: [finished], hasLive: false, unavailableLeagues: [] }
    render(<SportsColumn data={data} isLoading={false} />)
    expect(screen.getByText(/Final ·/)).toBeInTheDocument()
    expect(screen.queryByText(/no game today/i)).toBeNull()
  })

  it('still shows the off-day block when there is no game in either direction', () => {
    const data: GamesResponse = { games: [], hasLive: false, unavailableLeagues: [] }
    render(<SportsColumn data={data} isLoading={false} />)
    expect(screen.getByText(/no game|off day|dark/i)).toBeInTheDocument()
    expect(screen.queryByText(/Final ·/)).toBeNull()
  })
})
