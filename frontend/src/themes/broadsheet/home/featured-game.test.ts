import { describe, expect, it } from 'vitest'
import { pickFeaturedGame } from './featured-game'
import type { Game, GameState } from '@/integrations/sports'

const game = (id: string, state: GameState): Game =>
  ({
    id,
    league: 'MLB',
    state,
    name: id,
    startTime: '2026-05-22T16:40:00-07:00',
    venue: null,
    broadcast: null,
    playoffRound: null,
    home: {} as Game['home'],
    away: {} as Game['away'],
    clock: null,
    period: null,
    periodLabel: null,
    leaders: [],
    allLeaders: [],
    situation: null,
    lastPlay: null,
    headline: null,
    linescores: [],
    athletes: [],
    espnUrl: null,
    liveDetail: null,
  }) as Game

describe('pickFeaturedGame', () => {
  it('returns undefined when there are no games', () => {
    expect(pickFeaturedGame([])).toBeUndefined()
  })

  it('prefers a live game over an upcoming one', () => {
    const upcoming = game('a', 'upcoming')
    const live = game('b', 'live')
    expect(pickFeaturedGame([upcoming, live])).toBe(live)
  })

  it('falls back to the next upcoming game when nothing is live', () => {
    const upcoming = game('a', 'upcoming')
    expect(pickFeaturedGame([upcoming])).toBe(upcoming)
  })

  it('falls back to undefined when only finals or postponed games exist', () => {
    expect(pickFeaturedGame([game('a', 'final'), game('b', 'postponed')])).toBeUndefined()
  })
})
