import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PregameBlock } from './PregameBlock'
import type { Game } from '@/integrations/sports'

const useSportsPreview = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/sports', () => ({
  useSportsPreview,
  formatUpcomingTime: (s: string) => s,
}))

const team = (abbreviation: string) => ({
  id: abbreviation,
  name: abbreviation,
  abbreviation,
  logo: '',
  record: '70-48',
  score: null,
  winner: null,
  color: '005A9C',
  altColor: 'ffffff',
  hits: null,
  errors: null,
})

const game = {
  id: 'g1',
  league: 'mlb',
  state: 'upcoming',
  name: 'Kansas City Royals at Los Angeles Dodgers',
  startTime: '2026-08-11T02:10:00Z',
  broadcast: 'MLB.TV',
  away: team('KC'),
  home: team('LAD'),
  athletes: [],
} as unknown as Game

describe('PregameBlock', () => {
  beforeEach(() => {
    useSportsPreview.mockReturnValue({ data: undefined, isLoading: false, error: null })
  })

  it('shows the preview once it arrives', () => {
    useSportsPreview.mockReturnValue({
      data: { summary: 'The Dodgers are stuck in a rare funk.' },
      isLoading: false,
      error: null,
    })
    render(<PregameBlock game={game} />)
    expect(screen.getByText(/stuck in a rare funk/)).toBeInTheDocument()
  })

  // The preview used to render nothing at all until it arrived, so a cold
  // cache and a broken generator looked identical — and identical to a game
  // nobody had written about. It now reports which of those it is, the same
  // way the final report's recap does.
  it('says the preview is being written while it is pending', () => {
    useSportsPreview.mockReturnValue({ data: undefined, isLoading: true, error: null })
    render(<PregameBlock game={game} />)
    expect(screen.getByText(/Generating preview/i)).toBeInTheDocument()
  })

  it('says so when the preview failed, rather than going quiet', () => {
    useSportsPreview.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('502'),
    })
    render(<PregameBlock game={game} />)
    expect(screen.getByText(/Preview unavailable/i)).toBeInTheDocument()
  })

  it('treats a settled empty preview as unavailable, not as still pending', () => {
    useSportsPreview.mockReturnValue({ data: { summary: '' }, isLoading: false, error: null })
    render(<PregameBlock game={game} />)
    expect(screen.getByText(/Preview unavailable/i)).toBeInTheDocument()
    expect(screen.queryByText(/Generating preview/i)).toBeNull()
  })

  it('still names both teams whatever the preview is doing', () => {
    useSportsPreview.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('502'),
    })
    render(<PregameBlock game={game} />)
    expect(screen.getAllByText(/KC/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/LAD/).length).toBeGreaterThan(0)
  })
})
