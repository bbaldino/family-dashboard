import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LeagueColumn } from './LeagueColumn'
import type { SportColumn } from '@/integrations/sports'

const now = new Date('2026-09-28T18:00:00Z')
const base: SportColumn = {
  league: 'NFL',
  team: 'San Francisco 49ers',
  teamAbbr: 'SF',
  phase: 'regular',
  phaseDetail: 'Week 4',
  card: {
    record: '3-0',
    standing: '1st in NFC West',
    streak: 'W3',
    home: null,
    road: null,
    last10: null,
    last: null,
    next: null,
    seriesStatus: null,
    seasonEnded: null,
  },
  table: {
    title: 'NFC West',
    rows: [{ t: 'SF', w: 3, l: 0, pct: '1.000', gb: '—', strk: 'W3', me: true }],
  },
  scores: {
    rows: [
      {
        a: 'ARI',
        as: 30,
        h: 'SF',
        hs: 36,
        state: 'final',
        detail: 'Final',
        startsAt: '2026-09-27T20:05Z',
        mine: true,
      },
    ],
    total: 1,
  },
  postseason: null,
  brief: [
    {
      h: 'Purdy perfect',
      dek: 'Four TDs.',
      source: 'team',
      tag: '49ers',
      publishedAt: '2026-09-28T16:00:00Z',
    },
  ],
  leaders: null,
  hot: null,
  cold: null,
}

describe('LeagueColumn', () => {
  it('stacks card, table, scores and brief in the regular season', () => {
    render(<LeagueColumn column={base} now={now} />)
    expect(screen.getByTestId('team-card')).toBeInTheDocument()
    expect(screen.getByText('NFC West')).toBeInTheDocument()
    expect(screen.getByTestId('league-scores')).toBeInTheDocument()
    expect(screen.getByText('Purdy perfect')).toBeInTheDocument()
  })
  it('replaces table and scores with the series list in the postseason', () => {
    render(
      <LeagueColumn
        column={{
          ...base,
          phase: 'postseason',
          table: null,
          scores: null,
          postseason: {
            current: [],
            completed: [{ round: 'NLWC', summary: 'LAD def CIN 2–0' }],
            upcoming: [],
          },
        }}
        now={now}
      />,
    )
    expect(screen.getByTestId('postseason')).toBeInTheDocument()
    expect(screen.queryByTestId('league-scores')).not.toBeInTheDocument()
  })
  it('keeps an off-season column to card and brief', () => {
    render(
      <LeagueColumn
        column={{ ...base, phase: 'offseason', table: null, scores: null }}
        now={now}
      />,
    )
    expect(screen.queryByText('NFC West')).not.toBeInTheDocument()
    expect(screen.getByTestId('in-brief')).toBeInTheDocument()
  })
  it('renders no scores block at all when the slate has no games', () => {
    render(<LeagueColumn column={{ ...base, scores: { rows: [], total: 0 } }} now={now} />)
    expect(screen.queryByTestId('league-scores')).not.toBeInTheDocument()
    expect(screen.queryByText('Around the NFL')).not.toBeInTheDocument()
  })
  it('shows form and leaders in the regular season, and hides them outside it', () => {
    const withExtras: SportColumn = {
      ...base,
      hot: [{ t: 'SF', rec: '3-0', strk: 'W3' }],
      cold: [{ t: 'ARI', rec: '0-3', strk: 'L3' }],
      leaders: [{ cat: 'Passing yards', abbr: 'YDS', rows: [['B. Purdy', 'SF', '1200']] }],
    }
    const { unmount } = render(<LeagueColumn column={withExtras} now={now} />)
    expect(screen.getByText('Running hot')).toBeInTheDocument()
    expect(screen.getByText('Cold snap')).toBeInTheDocument()
    expect(screen.getByText('Passing yards')).toBeInTheDocument()
    unmount()

    render(
      <LeagueColumn
        column={{
          ...withExtras,
          phase: 'postseason',
          table: null,
          scores: null,
          postseason: { current: [], completed: [], upcoming: [] },
        }}
        now={now}
      />,
    )
    expect(screen.queryByText('Running hot')).not.toBeInTheDocument()
    expect(screen.queryByText('Passing yards')).not.toBeInTheDocument()
  })
})
