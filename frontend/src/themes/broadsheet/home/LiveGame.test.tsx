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

  it('formats the inning label as a single letter plus the number, not the whole word', () => {
    // Regression, found live against the replay backend: `inningHalf` on
    // the real feed is a whole word ("Bottom"), rendered unabbreviated in
    // a box sized for the compact form — the extra glyphs overflowed onto
    // the play text next to it ("BottoContreras homered..."). The mock's
    // compact form (`shared.jsx`'s `scoring` entries, `broadsheet-v2.jsx:456`)
    // is a single letter plus the inning number.
    const detail: GameLiveDetail = {
      sport: 'mlb',
      matchup: null,
      recentPlays: [],
      scoringPlays: [{ id: 'sp-0', text: 'Homered to left.', inningHalf: 'Bottom', inningNumber: 1, scoring: true, teamId: null }],
      inProgressScoring: [],
      scoringRecap: null,
      winProbability: null,
      leaders: { away: [], home: [] },
    }
    render(<LiveGame game={makeGame(detail)} />)
    expect(screen.getByText('B1')).toBeInTheDocument()
    expect(screen.queryByText(/Bottom/)).not.toBeInTheDocument()
  })

  it('formats the inning label regardless of the feed\'s casing', () => {
    const detail: GameLiveDetail = {
      sport: 'mlb',
      matchup: null,
      recentPlays: [{ id: 'rp-0', text: 'Grounded out.', inningHalf: 'top', inningNumber: 5, scoring: false, teamId: null }],
      scoringPlays: [],
      inProgressScoring: [],
      scoringRecap: null,
      winProbability: null,
      leaders: { away: [], home: [] },
    }
    render(<LiveGame game={makeGame(detail)} />)
    expect(screen.getByText('T5')).toBeInTheDocument()
  })

  it('renders no inning label rather than throwing when the half or number is missing', () => {
    const detail: GameLiveDetail = {
      sport: 'mlb',
      matchup: null,
      recentPlays: [{ id: 'rp-0', text: 'Grounded out.', inningHalf: null, inningNumber: null, scoring: false, teamId: null }],
      scoringPlays: [],
      inProgressScoring: [],
      scoringRecap: null,
      winProbability: null,
      leaders: { away: [], home: [] },
    }
    expect(() => render(<LiveGame game={makeGame(detail)} />)).not.toThrow()
    expect(screen.getByText('Grounded out.')).toBeInTheDocument()
  })

  it('derives one side of the win-probability split from the other so they always sum to 100', () => {
    // Regression, found live against the replay backend: rounding each
    // side independently could sum to 101 (or 99) — 20% and 81%, observed
    // on screen, is exactly this case (20.0 rounds to 20; 81.0 stays 81,
    // but the underlying probabilities don't sum to exactly 1 on the real
    // feed, so the naive computation drifted).
    const detail: GameLiveDetail = {
      sport: 'mlb',
      matchup: null,
      recentPlays: [],
      scoringPlays: [],
      inProgressScoring: [],
      scoringRecap: null,
      winProbability: { away: 0.2, home: 0.81 },
      leaders: { away: [], home: [] },
    }
    render(<LiveGame game={makeGame(detail)} />)
    expect(screen.getByText(/LAD 20%/)).toBeInTheDocument()
    expect(screen.getByText(/80% MIL/)).toBeInTheDocument()
    expect(screen.queryByText(/81% MIL/)).not.toBeInTheDocument()
  })
})
