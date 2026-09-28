import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeamCard } from './TeamCard'
import type { SportColumn, TeamCardData } from '@/integrations/sports'

const card = (over: Partial<TeamCardData> = {}): TeamCardData => ({
  record: '3-0',
  standing: '1st in NFC West',
  streak: 'W3',
  home: '2-0',
  road: '1-0',
  last10: null,
  last: {
    result: 'W',
    score: '36–30',
    opponent: 'ARI',
    homeAway: 'home',
    startsAt: '2026-09-27T20:05Z',
  },
  next: {
    opponent: 'LAR',
    homeAway: 'away',
    startsAt: '2026-10-04T20:25Z',
    tv: 'FOX',
    label: null,
  },
  seriesStatus: null,
  seasonEnded: null,
  ...over,
})

const column = (over: Partial<SportColumn> = {}): SportColumn => ({
  league: 'NFL',
  team: 'San Francisco 49ers',
  teamAbbr: 'SF',
  phase: 'regular',
  phaseDetail: 'Week 4',
  card: card(),
  table: null,
  scores: null,
  postseason: null,
  brief: [],
  leaders: null,
  hot: null,
  cold: null,
  ...over,
})

describe('TeamCard', () => {
  it('leads a regular-season card with record, standing, form, last and next', () => {
    render(<TeamCard column={column()} />)
    expect(screen.getByText('3-0')).toBeInTheDocument()
    expect(screen.getByText('1st in NFC West')).toBeInTheDocument()
    expect(screen.getByText(/W3 · Home 2-0 · Road 1-0/)).toBeInTheDocument()
    expect(screen.getByText(/36–30 vs ARI/)).toBeInTheDocument()
    expect(screen.getByText(/@ LAR/)).toBeInTheDocument()
    expect(screen.getByText(/FOX/)).toBeInTheDocument()
    expect(screen.getByText('Week 4')).toBeInTheDocument()
  })

  it('shows the series status in the postseason instead of the record', () => {
    render(
      <TeamCard
        column={column({
          phase: 'postseason',
          phaseDetail: 'Postseason',
          card: card({ seriesStatus: 'NLDS · LAD leads 1–0 · best of 5', last: null }),
        })}
      />,
    )
    expect(screen.getByText('NLDS · LAD leads 1–0 · best of 5')).toBeInTheDocument()
    expect(screen.queryByText('3-0')).not.toBeInTheDocument()
  })

  it('says how a finished season ended', () => {
    render(
      <TeamCard
        column={column({
          phase: 'postseason',
          card: card({ seasonEnded: 'Out in NLDS, 1–3 to SD', next: null }),
        })}
      />,
    )
    expect(screen.getByText('Out in NLDS, 1–3 to SD')).toBeInTheDocument()
  })

  it('keeps an off-season card to the next game and phase', () => {
    render(<TeamCard column={column({ phase: 'offseason', phaseDetail: 'Season opens Oct 21' })} />)
    expect(screen.getByText('Season opens Oct 21')).toBeInTheDocument()
    expect(screen.queryByText('3-0')).not.toBeInTheDocument()
    expect(screen.queryByText(/LAST/)).not.toBeInTheDocument()
    expect(screen.getByText(/@ LAR/)).toBeInTheDocument()
  })

  it('omits LAST and NEXT when the schedule is unavailable', () => {
    render(<TeamCard column={column({ card: card({ last: null, next: null }) })} />)
    expect(screen.queryByText('LAST')).not.toBeInTheDocument()
    expect(screen.queryByText('NEXT')).not.toBeInTheDocument()
  })
})
