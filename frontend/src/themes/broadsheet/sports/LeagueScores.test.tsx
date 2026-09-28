import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LeagueScores } from './LeagueScores'
import type { ScoreLine } from '@/integrations/sports'

const line = (over: Partial<ScoreLine>): ScoreLine => ({
  a: 'ARI',
  as: 30,
  h: 'SF',
  hs: 36,
  state: 'final',
  detail: 'Final',
  startsAt: '2026-09-27T20:05Z',
  mine: false,
  ...over,
})

describe('LeagueScores', () => {
  it('marks live games with their status and caps the slate', () => {
    const rows = [
      line({ mine: true }),
      line({ a: 'NYY', as: 3, h: 'BOS', hs: 1, state: 'live', detail: 'Top 7th' }),
      line({ a: 'KC', h: 'LV' }),
    ]
    render(<LeagueScores league="MLB" slate={{ rows, total: 5 }} max={2} />)
    expect(screen.getByText('Around the MLB')).toBeInTheDocument()
    // `getByText` matches an element's own text nodes: "● " + "Top 7th".
    expect(screen.getByText(/Top 7th/)).toBeInTheDocument()
    expect(screen.queryByText(/KC/)).not.toBeInTheDocument()
    expect(screen.getByText('+3 more')).toBeInTheDocument()
  })
  it('shows an upcoming game by its start, not a 0–0 score', () => {
    render(
      <LeagueScores
        league="MLB"
        slate={{
          rows: [line({ a: 'PHI', as: 0, h: 'ATL', hs: 0, state: 'upcoming', detail: '7:10 PM' })],
          total: 1,
        }}
        max={5}
      />,
    )
    expect(screen.getByText(/PHI/)).toBeInTheDocument()
    expect(screen.queryByText(/PHI 0/)).not.toBeInTheDocument()
  })
})
