import { describe, expect, it } from 'vitest'
import { orderSummaries, pickFeaturedGame } from './featured-game'
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

const ids = (games: Game[]) => games.map((g) => g.id)

describe('orderSummaries', () => {
  it('returns nothing when there are no games', () => {
    expect(orderSummaries([])).toEqual([])
  })

  it('leads with the featured live game, then other live games, then finals newest first', () => {
    const games = [
      game('live-early', 'live', '2026-09-27T19:05:00Z'),
      game('live-late', 'live', '2026-09-27T20:05:00Z'),
      game('final-old', 'final', '2026-09-26T20:10:00Z'),
      game('final-new', 'final', '2026-09-27T17:10:00Z'),
    ]
    expect(ids(orderSummaries(games))).toEqual([
      'live-early',
      'live-late',
      'final-new',
      'final-old',
    ])
  })

  // The pregame rule — the last result beneath the next game's preview —
  // falls out of the order, now followed by every other final too.
  it('leads with the next upcoming game and follows it with the finals', () => {
    const games = [
      game('next', 'upcoming', '2026-09-28T23:10:00Z'),
      game('final-old', 'final', '2026-09-26T20:10:00Z'),
      game('final-new', 'final', '2026-09-27T17:10:00Z'),
    ]
    expect(ids(orderSummaries(games))).toEqual(['next', 'final-new', 'final-old'])
  })

  it('leads with the most recent final when nothing is live or upcoming', () => {
    const games = [
      game('mlb', 'final', '2026-09-27T19:05:00Z'),
      game('nfl', 'final', '2026-09-27T20:05:00Z'),
    ]
    expect(ids(orderSummaries(games))).toEqual(['nfl', 'mlb'])
  })

  it('leaves out upcoming games beyond the featured one, and postponed games', () => {
    const games = [
      game('next', 'upcoming', '2026-09-28T23:10:00Z'),
      game('after', 'upcoming', '2026-09-29T23:10:00Z'),
      game('off', 'postponed', '2026-09-28T20:10:00Z'),
    ]
    expect(ids(orderSummaries(games))).toEqual(['next'])
  })

  // Why this compares parsed instants rather than the strings: these two are
  // written in different forms, and the mixed forms are real — the backend
  // emits `...T23:00Z` while other feeds and fixtures carry a numeric offset.
  // Sorted as text, "2026-08-09T23:00:00Z" beats "2026-08-09T16:40:00-07:00",
  // but the offset form is the later moment (23:40Z).
  it('orders finals by instant, not by the text of the timestamp', () => {
    const games = [
      game('later-looking', 'final', '2026-08-09T23:00:00Z'),
      game('actually-later', 'final', '2026-08-09T16:40:00-07:00'),
    ]
    expect(ids(orderSummaries(games))).toEqual(['actually-later', 'later-looking'])
  })

  it('sorts a final whose start time cannot be parsed after the rest, rather than dropping it', () => {
    const games = [
      game('broken', 'final', 'not a date'),
      game('good', 'final', '2026-08-09T20:10:00Z'),
    ]
    expect(ids(orderSummaries(games))).toEqual(['good', 'broken'])
  })
})
