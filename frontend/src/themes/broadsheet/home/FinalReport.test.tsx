import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinalReport } from './FinalReport'
import type { Game } from '@/integrations/sports'

const useSportsFinalRecap = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/sports', async () => {
  // The date formatter is pure and has no transport behind it, so the real
  // one comes through rather than being stubbed into agreeing with the test.
  const formatTime = await vi.importActual<typeof import('@/integrations/sports/formatTime')>(
    '@/integrations/sports/formatTime',
  )
  return { useSportsFinalRecap, ...formatTime }
})

const team = (abbreviation: string, score: number, winner: boolean) => ({
  id: abbreviation,
  name: abbreviation,
  abbreviation,
  logo: '',
  record: '70-48',
  score,
  winner,
  color: '005A9C',
  altColor: 'ffffff',
  hits: 6,
  errors: 0,
})

const game = {
  id: 'g1',
  league: 'mlb',
  state: 'final',
  name: 'Los Angeles Dodgers at Arizona Diamondbacks',
  startTime: '2026-08-09T20:10:00Z',
  away: team('LAD', 2, false),
  home: team('ARI', 4, true),
} as unknown as Game

describe('FinalReport', () => {
  beforeEach(() => {
    useSportsFinalRecap.mockReturnValue({ data: undefined, isLoading: false, error: null })
  })

  it('reports the score with the date of the game', () => {
    render(<FinalReport game={game} />)
    expect(screen.getByText(/Sun, Aug 9/)).toBeInTheDocument()
    expect(screen.getByTestId('final-side-away')).toHaveTextContent('LAD 2')
    expect(screen.getByTestId('final-side-home')).toHaveTextContent('ARI 4')
  })

  it('says the recap is being written while it is pending', () => {
    useSportsFinalRecap.mockReturnValue({ data: undefined, isLoading: true, error: null })
    render(<FinalReport game={game} />)
    expect(screen.getByText(/Generating recap/i)).toBeInTheDocument()
  })

  it('shows the recap once it arrives', () => {
    useSportsFinalRecap.mockReturnValue({
      data: { summary: 'Rodriguez was dialed in for the Diamondbacks.' },
      isLoading: false,
      error: null,
    })
    render(<FinalReport game={game} />)
    expect(screen.getByText(/Rodriguez was dialed in/)).toBeInTheDocument()
    expect(screen.queryByText(/Generating recap/i)).toBeNull()
  })

  // Grid's `AiFinalRecap` renders null in this case. This theme says so
  // instead: `OffdayBlock`'s own comment records ESPN refusing this app's
  // requests for weeks while the column reported a plausible off-day, and a
  // recap that silently never arrives is that same invisible failure.
  it('says so when the recap failed, rather than going quiet', () => {
    useSportsFinalRecap.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('502'),
    })
    render(<FinalReport game={game} />)
    expect(screen.getByText(/Recap unavailable/i)).toBeInTheDocument()
  })

  it('treats a settled empty summary as unavailable, not as still pending', () => {
    useSportsFinalRecap.mockReturnValue({ data: { summary: '' }, isLoading: false, error: null })
    render(<FinalReport game={game} />)
    expect(screen.getByText(/Recap unavailable/i)).toBeInTheDocument()
    // The distinction that matters: "Generating recap…" would sit on the wall
    // forever, since nothing further is coming.
    expect(screen.queryByText(/Generating recap/i)).toBeNull()
  })

  it('still reports the score when the recap failed', () => {
    useSportsFinalRecap.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('502'),
    })
    render(<FinalReport game={game} />)
    expect(screen.getByTestId('final-side-home')).toHaveTextContent('ARI 4')
  })

  it('sets the winner in full ink and the loser muted', () => {
    render(<FinalReport game={game} />)
    expect(screen.getByTestId('final-side-home').style.color).toBe('var(--ink)')
    expect(screen.getByTestId('final-side-away').style.color).toBe('var(--ink-muted)')
  })
})
