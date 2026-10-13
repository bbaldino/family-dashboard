import { describe, expect, it } from 'vitest'
import { sportWording } from './sport-wording'

describe('sportWording', () => {
  it.each([
    ['mlb', 'Baseball', 'first pitch'],
    ['nba', 'Basketball', 'tip-off'],
    ['nfl', 'Football', 'kickoff'],
    ['nhl', 'Hockey', 'puck drop'],
  ])('names %s and its start', (league, name, start) => {
    expect(sportWording(league)).toEqual({ name, start })
  })

  it('ignores the league code case', () => {
    expect(sportWording('NBA')).toEqual({ name: 'Basketball', start: 'tip-off' })
  })

  it('falls back to the league code and no start word for an unknown league', () => {
    // Never borrow another sport's word: a guess is how basketball ended up
    // with a "first pitch".
    expect(sportWording('mls')).toEqual({ name: 'MLS', start: null })
  })
})
