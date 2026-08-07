import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { GamesResponse } from '@/integrations/sports'
import { SportsWidget } from './SportsWidget'

const useSportsGames = vi.hoisted(() =>
  vi.fn<
    () => {
      data: GamesResponse | undefined
      isLoading: boolean
      error: unknown
      refetch: () => void
    }
  >(),
)

vi.mock('@/integrations/sports', async () => {
  const actual =
    await vi.importActual<typeof import('@/integrations/sports')>('@/integrations/sports')
  return { ...actual, useSportsGames }
})

beforeEach(() => {
  useSportsGames.mockReset()
})

/** Three ways for the widget to have no games, and only one of them is a
 *  fault. They rendered identically until the backend started naming the
 *  leagues it couldn't reach — which is how a dead ESPN integration passed
 *  for a quiet season for weeks. */
describe('SportsWidget with nothing to show', () => {
  it('reports an unreachable league instead of claiming no games today', () => {
    useSportsGames.mockReturnValue({
      data: { games: [], hasLive: false, unavailableLeagues: ['mlb'] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<SportsWidget />)

    expect(screen.getByText(/scores unavailable/i)).toBeInTheDocument()
    expect(screen.getByText(/MLB/)).toBeInTheDocument()
    expect(screen.queryByText('No games today')).toBeNull()
  })

  it('still says "No games today" when every league answered and none had one', () => {
    useSportsGames.mockReturnValue({
      data: { games: [], hasLive: false, unavailableLeagues: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    render(<SportsWidget />)

    expect(screen.getByText('No games today')).toBeInTheDocument()
    expect(screen.queryByText(/unavailable/i)).toBeNull()
  })
})
