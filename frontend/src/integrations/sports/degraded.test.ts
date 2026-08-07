import { describe, expect, it } from 'vitest'
import { formatUnavailableLeagues, scoreboardIsDown } from './degraded'
import type { GamesResponse } from './types'

const response = (over: Partial<GamesResponse> = {}): GamesResponse => ({
  games: [],
  hasLive: false,
  unavailableLeagues: [],
  ...over,
})

describe('scoreboardIsDown', () => {
  it('is true when nothing came back and a league could not be reached', () => {
    expect(scoreboardIsDown(response({ unavailableLeagues: ['mlb'] }))).toBe(true)
  })

  it('is false for an empty response with every league accounted for', () => {
    // Either nobody has tracked a team, or the tracked teams are simply out
    // of season. Both are the truth, not a fault.
    expect(scoreboardIsDown(response())).toBe(false)
  })

  it('is false while there is nothing to judge yet', () => {
    expect(scoreboardIsDown(undefined)).toBe(false)
  })

  it('is false when one league is out but another still produced games', () => {
    // Partial degradation still fills the column, and the display has
    // something true to show. Shouting about it would cost more than it buys.
    const withGames = response({
      games: [{ id: '1' } as GamesResponse['games'][number]],
      unavailableLeagues: ['nba'],
    })
    expect(scoreboardIsDown(withGames)).toBe(false)
  })
})

describe('formatUnavailableLeagues', () => {
  it('names one league', () => {
    expect(formatUnavailableLeagues(['mlb'])).toBe('MLB')
  })

  it('joins two with "or"', () => {
    expect(formatUnavailableLeagues(['mlb', 'nba'])).toBe('MLB or NBA')
  })

  it('commas all but the last', () => {
    expect(formatUnavailableLeagues(['mlb', 'nba', 'nfl'])).toBe('MLB, NBA or NFL')
  })

  it('is empty for an empty list', () => {
    expect(formatUnavailableLeagues([])).toBe('')
  })
})
