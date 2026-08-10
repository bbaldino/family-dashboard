import { describe, expect, it } from 'vitest'
import { pickFeaturedGame, pickPriorFinal } from './featured-game'
import type { Game, GameState } from '@/integrations/sports'

const game = (id: string, state: GameState, startTime = '2026-05-22T16:40:00-07:00'): Game =>
  ({
    id,
    league: 'MLB',
    state,
    name: id,
    startTime,
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

describe('pickPriorFinal', () => {
  it('returns the most recent final', () => {
    const games = [
      game('older', 'final', '2026-08-08T20:10:00Z'),
      game('newest', 'final', '2026-08-09T20:10:00Z'),
      game('middle', 'final', '2026-08-09T02:10:00Z'),
    ]
    expect(pickPriorFinal(games)?.id).toBe('newest')
  })

  // Why this compares parsed instants rather than the strings: these two are
  // written in different forms, and the mixed forms are real — the backend
  // emits `...T23:00Z` while other feeds and fixtures carry a numeric offset.
  // Sorted as text, "2026-08-09T23:00:00Z" beats "2026-08-09T16:40:00-07:00",
  // but the offset form is the later moment (23:40Z).
  it('orders by instant, not by the text of the timestamp', () => {
    const games = [
      game('later-looking', 'final', '2026-08-09T23:00:00Z'),
      game('actually-later', 'final', '2026-08-09T16:40:00-07:00'),
    ]
    expect(pickPriorFinal(games)?.id).toBe('actually-later')
  })

  it('ignores games that are not final', () => {
    const games = [
      game('live', 'live', '2026-08-09T20:10:00Z'),
      game('next', 'upcoming', '2026-08-11T02:10:00Z'),
      game('off', 'postponed', '2026-08-09T20:10:00Z'),
    ]
    expect(pickPriorFinal(games)).toBeUndefined()
  })

  it('returns undefined for an empty list', () => {
    expect(pickPriorFinal([])).toBeUndefined()
  })

  it('skips a final whose start time cannot be parsed', () => {
    const games = [
      game('broken', 'final', 'not a date'),
      game('good', 'final', '2026-08-09T20:10:00Z'),
    ]
    expect(pickPriorFinal(games)?.id).toBe('good')
  })
})
