import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Sports } from './Sports'
import { sportsSectionFixtureFor } from '@/integrations/sports/section-fixtures'

const useSportsSection = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/sports', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/integrations/sports')>()),
  useSportsSection,
}))

describe('Sports', () => {
  beforeEach(() => useSportsSection.mockReset())

  it('lays out one column per league, in the given order', () => {
    useSportsSection.mockReturnValue({ data: sportsSectionFixtureFor('sports-autumn') })
    render(<Sports />)
    const cols = screen.getAllByTestId(/^league-column-/)
    expect(cols.map((c) => c.dataset.testid)).toEqual([
      'league-column-NFL',
      'league-column-MLB',
      'league-column-NBA',
    ])
  })

  it('narrows preseason and off-season columns', () => {
    useSportsSection.mockReturnValue({ data: sportsSectionFixtureFor('sports-autumn') })
    render(<Sports />)
    expect(screen.getByTestId('sports-body').style.gridTemplateColumns).toBe('1fr 1fr 0.62fr')
  })

  it('carries the season clock in the right ear, with no lead art, house line or Next up', () => {
    useSportsSection.mockReturnValue({ data: sportsSectionFixtureFor('sports-autumn') })
    render(<Sports />)
    expect(screen.getByText('week 4 of 18')).toBeInTheDocument()
    expect(screen.queryByText(/from the house/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/next up/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('keeps an off-season column to a compact card and In brief', () => {
    useSportsSection.mockReturnValue({ data: sportsSectionFixtureFor('sports-summer') })
    render(<Sports />)
    expect(screen.getByTestId('sports-body').style.gridTemplateColumns).toBe('1fr 0.62fr 0.62fr')
    const nba = screen.getByTestId('league-column-NBA')
    expect(within(nba).getByText('Season opens Oct 21')).toBeInTheDocument()
    expect(within(nba).getByText('NEXT')).toBeInTheDocument()
    expect(within(nba).getByTestId('in-brief')).toBeInTheDocument()
    expect(within(nba).queryByRole('table')).not.toBeInTheDocument()
    expect(within(nba).queryByTestId('league-scores')).not.toBeInTheDocument()
    expect(within(nba).queryByTestId('postseason')).not.toBeInTheDocument()
  })

  it('follows the field in the postseason even when the team is out', () => {
    useSportsSection.mockReturnValue({ data: sportsSectionFixtureFor('sports-eliminated') })
    render(<Sports />)
    expect(screen.getByText('Out in NLDS, 1–3 to SD')).toBeInTheDocument()
    expect(screen.getByTestId('postseason')).toBeInTheDocument()
  })

  it('renders a holding state before the section loads', () => {
    useSportsSection.mockReturnValue({ data: undefined })
    render(<Sports />)
    expect(screen.getByText('Checking the wires…')).toBeInTheDocument()
  })

  it('shows an empty state when there are no columns', () => {
    useSportsSection.mockReturnValue({ data: { clock: [], columns: [] } })
    render(<Sports />)
    expect(screen.getByText('No sports to report.')).toBeInTheDocument()
    expect(screen.queryByTestId('sports-body')).not.toBeInTheDocument()
  })
})
