import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { Sports } from './Sports'
import type { SportsSection, SportsTrack } from '@/integrations/sports'

const useSportsSection = vi.hoisted(() => vi.fn())
vi.mock('@/integrations/sports', () => ({ useSportsSection }))

// useNow is real (returns a Date); the screen only formats it for the kicker,
// so it needs no stubbing.

const track = (over: Partial<SportsTrack> = {}): SportsTrack => ({
  league: 'MLB',
  team: 'Los Angeles Dodgers',
  seasonType: 'Regular Season',
  record: '72–48',
  standing: '1st in NL West',
  home: '35-23',
  away: '37-25',
  next: 'KC @ LAD · Thu Aug 13',
  headline: 'Muncy walks it off in the tenth',
  dek: 'A single scored Ohtani to end it.',
  caption: 'Muncy at the plate.',
  more: [
    { h: 'Snell strikes out ten in his return', dek: 'Back from the IL.', meta: 'Wed · Headline' },
    { h: 'Skubal struggles in the opener', dek: 'A rough debut.', meta: 'Tue · Media' },
  ],
  table: {
    title: 'National League',
    sub: 'top of the table',
    rows: [
      { t: 'MIL', w: 74, l: 46, pct: '.617', gb: '—', strk: 'L2' },
      { t: 'LAD', w: 72, l: 48, pct: '.600', gb: '2', strk: 'W2', me: true },
      { t: 'CHC', w: 70, l: 50, pct: '.583', gb: '4', strk: 'W2' },
    ],
  },
  scoresLabel: "Tuesday's",
  scores: Array.from({ length: 15 }, (_, i) => ({
    a: 'AAA',
    as: i,
    h: 'HHH',
    hs: i + 1,
    star: `Player ${i}`,
    line: '2-4, HR',
  })),
  leaders: [
    { cat: 'Home runs', abbr: 'HR', rows: [['M. Olson', 'ATL', '35']] },
    { cat: 'Batting average', abbr: 'AVG', rows: [['Y. Alvarez', 'HOU', '.322']] },
  ],
  hot: [{ t: 'TB', rec: '73-46', strk: 'W8' }],
  cold: [{ t: 'SEA', rec: '56-64', strk: 'L5' }],
  ...over,
})

const section = (over: Partial<SportsSection> = {}): SportsSection => ({
  fixtures: [{ team: 'Dodgers', detail: 'vs KC · Thu 7:10p' }],
  clock: [{ league: 'MLB', detail: '42 games left' }],
  standfirst: 'The house on the day in sport.',
  leagues: [track()],
  elsewhere: [
    {
      league: 'NFL',
      team: 'San Francisco 49ers',
      record: '0-0',
      tag: 'preseason',
      note: 'Preseason opens Saturday.',
      story: { h: 'Purdy sharp in camp', meta: 'Tue · Headline' },
    },
    {
      league: 'NBA',
      team: 'Golden State Warriors',
      record: null,
      note: 'Season opens Sep 30.',
      story: { h: 'Curry to finish with the Warriors', meta: 'Wed · Headline' },
    },
  ],
  ...over,
})

describe('Sports', () => {
  beforeEach(() => {
    useSportsSection.mockReturnValue({ data: section() })
  })

  it('names the page in the centre and carries live data in both ears', () => {
    render(<Sports />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sports')
    // Left ear: fixtures. Right ear: season clock.
    expect(screen.getByText('Next up')).toBeInTheDocument()
    expect(screen.getByText('vs KC · Thu 7:10p')).toBeInTheDocument()
    expect(screen.getByText('Season')).toBeInTheDocument()
    expect(screen.getByText('42 games left')).toBeInTheDocument()
  })

  describe('single front', () => {
    it('leads with the one track and shows its follow-ups', () => {
      render(<Sports />)
      expect(screen.getByText(/Lead · MLB/)).toBeInTheDocument()
      expect(screen.queryByText(/Second front/)).not.toBeInTheDocument()
      // Follow-ups sit under the lead on a single front.
      expect(screen.getByText('Snell strikes out ten in his return')).toBeInTheDocument()
    })

    it('rolls scores past the cap into a "+N more finals" line', () => {
      render(<Sports />)
      // 15 scores, single-front cap 10 → 5 hidden.
      expect(screen.getByText('+5 more finals')).toBeInTheDocument()
    })

    it('marks the followed team’s table row', () => {
      render(<Sports />)
      const col2 = screen.getByTestId('sports-col-2')
      const ladCell = within(col2).getByText('LAD')
      expect(ladCell).toHaveStyle({ color: 'var(--rust)' })
    })

    it('names the season under the standfirst', () => {
      render(<Sports />)
      expect(screen.getByText(/MLB · Regular Season/)).toBeInTheDocument()
    })
  })

  describe('split front', () => {
    beforeEach(() => {
      useSportsSection.mockReturnValue({
        data: section({
          leagues: [
            track(),
            track({
              league: 'NFL',
              team: 'San Francisco 49ers',
              headline: 'Purdy throws three',
              more: [{ h: 'Kittle limited in practice', dek: '', meta: 'Sat · Headline' }],
            }),
          ],
          elsewhere: [
            {
              league: 'NBA',
              team: 'Golden State Warriors',
              record: null,
              tag: 'preseason',
              note: 'Camp opens Tuesday.',
              story: { h: 'Warriors open camp', meta: 'Sat · Headline' },
            },
          ],
        }),
      })
    })

    it('runs two leads and labels the second a Second front', () => {
      render(<Sports />)
      expect(screen.getByText(/Lead · MLB/)).toBeInTheDocument()
      expect(screen.getByText(/Second front · NFL/)).toBeInTheDocument()
    })

    it('moves the follow-ups out of column 1 into In brief', () => {
      render(<Sports />)
      const col1 = screen.getByTestId('sports-col-1')
      // The lead's own follow-ups are not repeated under the two leads.
      expect(within(col1).queryByText('Snell strikes out ten in his return')).toBeNull()
      // In brief (col 4) carries each track's top follow-up plus elsewhere.
      const col4 = screen.getByTestId('sports-col-4')
      expect(within(col4).getByText('Snell strikes out ten in his return')).toBeInTheDocument()
    })

    it('labels Form with the primary league only', () => {
      render(<Sports />)
      expect(screen.getByText('Form · MLB')).toBeInTheDocument()
    })

    it('names both leagues under the standfirst', () => {
      render(<Sports />)
      expect(screen.getByText(/MLB \+ NFL · Regular Season/)).toBeInTheDocument()
    })
  })

  it('takes at most two tracks, however many the data carries', () => {
    useSportsSection.mockReturnValue({
      data: section({
        leagues: [
          track({ league: 'MLB' }),
          track({ league: 'NFL', headline: 'NFL lead' }),
          track({ league: 'NHL', headline: 'NHL lead' }),
        ],
      }),
    })
    render(<Sports />)
    expect(screen.getByText(/Lead · MLB/)).toBeInTheDocument()
    expect(screen.getByText(/Second front · NFL/)).toBeInTheDocument()
    // The third league never becomes a front.
    expect(screen.queryByText('NHL lead')).not.toBeInTheDocument()
  })

  describe('elsewhere', () => {
    it('shows a preseason team as its 0-0 record plus a tag', () => {
      render(<Sports />)
      const col2 = screen.getByTestId('sports-col-2')
      const row = within(col2).getByText('San Francisco 49ers').closest('div')!
      expect(within(row).getByText('0-0')).toBeInTheDocument()
      expect(within(row).getByText('PRESEASON')).toBeInTheDocument()
    })

    it('shows an off-season team as a phrase, not an empty record', () => {
      render(<Sports />)
      const col2 = screen.getByTestId('sports-col-2')
      const row = within(col2).getByText('Golden State Warriors').closest('div')!
      expect(within(row).getByText('off-season')).toBeInTheDocument()
      expect(within(col2).getByText('Season opens Sep 30.')).toBeInTheDocument()
    })
  })

  it('renders a holding state before the section loads', () => {
    useSportsSection.mockReturnValue({ data: undefined })
    render(<Sports />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sports')
    expect(screen.getByText(/Checking the wires/)).toBeInTheDocument()
  })

  it('shows an empty state rather than crashing on a section with no tracks', () => {
    // `SportsBody` reads `tracks[0]`, so an empty `leagues` must not reach it —
    // the backend returns this when no team is tracked or every league fails.
    useSportsSection.mockReturnValue({
      data: { fixtures: [], clock: [], standfirst: '', leagues: [], elsewhere: [] },
    })
    expect(() => render(<Sports />)).not.toThrow()
    expect(screen.getByText('No sports to report.')).toBeInTheDocument()
  })
})
