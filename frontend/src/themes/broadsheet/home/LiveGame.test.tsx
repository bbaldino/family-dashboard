import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveGame } from './LiveGame'
import type { Game, GameLeader, GameLiveDetail, GameTeam, Play } from '@/data/sports'

const team = (abbreviation: string, score: number): GameTeam => ({
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

const play = (id: string, text: string): Play => ({
  id,
  text,
  inningHalf: 'top',
  inningNumber: 7,
  scoring: true,
  teamId: null,
})

const leader = (name: string): GameLeader => ({
  category: 'hits',
  playerName: name,
  displayValue: '2-4',
})

function makeGame(liveDetail: GameLiveDetail | null): Game {
  return {
    id: 'g1',
    league: 'MLB',
    state: 'live',
    name: 'LAD @ MIL',
    startTime: '2026-05-22T16:40:00-07:00',
    venue: null,
    broadcast: 'MLB.TV',
    playoffRound: null,
    home: team('MIL', 3),
    away: team('LAD', 4),
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
    liveDetail,
  }
}

describe('LiveGame', () => {
  it('caps the leaders list per side instead of rendering every entry', () => {
    // A 6-leader list on either side is well past what real ESPN payloads
    // carry (usually 2-3 categories), but the component must not render it
    // in full — the leaders block shares a fixed-height, overflow-hidden
    // row with the plays grid below it.
    const detail: GameLiveDetail = {
      sport: 'mlb',
      matchup: null,
      recentPlays: [],
      scoringPlays: [],
      inProgressScoring: [],
      scoringRecap: null,
      winProbability: null,
      leaders: {
        away: Array.from({ length: 6 }, (_, i) => leader(`Away Player ${i}`)),
        home: Array.from({ length: 6 }, (_, i) => leader(`Home Player ${i}`)),
      },
    }
    render(<LiveGame game={makeGame(detail)} />)

    expect(screen.getByText('Away Player 0')).toBeInTheDocument()
    expect(screen.getByText('Away Player 2')).toBeInTheDocument()
    expect(screen.queryByText('Away Player 3')).not.toBeInTheDocument()
    expect(screen.queryByText('Away Player 5')).not.toBeInTheDocument()

    expect(screen.getByText('Home Player 0')).toBeInTheDocument()
    expect(screen.getByText('Home Player 2')).toBeInTheDocument()
    expect(screen.queryByText('Home Player 3')).not.toBeInTheDocument()
    expect(screen.queryByText('Home Player 5')).not.toBeInTheDocument()
  })

  it('caps the raw scoring-plays list when no recap has been generated yet', () => {
    const detail: GameLiveDetail = {
      sport: 'mlb',
      matchup: null,
      recentPlays: [],
      scoringPlays: Array.from({ length: 6 }, (_, i) => play(`sp-${i}`, `Scoring play number ${i}`)),
      inProgressScoring: [],
      scoringRecap: null,
      winProbability: null,
      leaders: { away: [], home: [] },
    }
    render(<LiveGame game={makeGame(detail)} />)

    expect(screen.getByText('Scoring play number 0')).toBeInTheDocument()
    expect(screen.getByText('Scoring play number 2')).toBeInTheDocument()
    expect(screen.queryByText('Scoring play number 3')).not.toBeInTheDocument()
    expect(screen.queryByText('Scoring play number 5')).not.toBeInTheDocument()
  })

  it('caps recent plays the same way', () => {
    const detail: GameLiveDetail = {
      sport: 'mlb',
      matchup: null,
      recentPlays: Array.from({ length: 6 }, (_, i) => play(`rp-${i}`, `Recent play number ${i}`)),
      scoringPlays: [],
      inProgressScoring: [],
      scoringRecap: null,
      winProbability: null,
      leaders: { away: [], home: [] },
    }
    render(<LiveGame game={makeGame(detail)} />)

    expect(screen.getByText('Recent play number 0')).toBeInTheDocument()
    expect(screen.getByText('Recent play number 2')).toBeInTheDocument()
    expect(screen.queryByText('Recent play number 3')).not.toBeInTheDocument()
  })

  it('prefers the compact scoring recap over the raw play-by-play once one is cached', () => {
    // The backend only ever supplies a handful of plays for the current,
    // still-in-progress half-inning here — everything completed is folded
    // into `recap.text` instead, which is what keeps this block cheap on
    // space for a high-scoring game.
    const detail: GameLiveDetail = {
      sport: 'mlb',
      matchup: null,
      recentPlays: [],
      scoringPlays: Array.from({ length: 6 }, (_, i) => play(`sp-${i}`, `Old scoring play ${i}`)),
      inProgressScoring: [play('ip-0', 'Current half-inning play')],
      scoringRecap: { text: 'LAD scored 4 across the first six innings.', throughInning: { half: 'top', number: 6 } },
      winProbability: null,
      leaders: { away: [], home: [] },
    }
    render(<LiveGame game={makeGame(detail)} />)

    expect(screen.getByText('LAD scored 4 across the first six innings.')).toBeInTheDocument()
    expect(screen.getByText('Current half-inning play')).toBeInTheDocument()
    // The raw scoring list is superseded by the recap — none of it renders.
    expect(screen.queryByText('Old scoring play 0')).not.toBeInTheDocument()
  })

  it('renders nothing for leaders or plays when liveDetail is absent', () => {
    expect(() => render(<LiveGame game={makeGame(null)} />)).not.toThrow()
  })
})
