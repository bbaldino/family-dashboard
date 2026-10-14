import { describe, expect, it } from 'vitest'
import { leaderStatText } from './leader-stat'

describe('leaderStatText', () => {
  it.each([
    ['nba', 'Points', '24', '24 PTS'],
    ['nba', 'Rebounds', '8', '8 REB'],
    ['nba', 'Assists', '8', '8 AST'],
    ['NBA', 'Points', '24', '24 PTS'],
    ['nhl', 'Goals', '2', '2 G'],
    ['nhl', 'Assists', '1', '1 A'],
    ['nhl', 'Points', '3', '3 PTS'],
    ['nfl', 'Sacks', '0.5', '0.5 SACKS'],
  ])('labels a bare %s %s figure', (league, category, value, text) => {
    expect(leaderStatText(league, category, value)).toBe(text)
  })

  it('leaves a value that already names its stats alone', () => {
    expect(leaderStatText('nfl', 'Passing Yards', '24/39, 331 YDS, 2 TD, 1 INT')).toBe(
      '24/39, 331 YDS, 2 TD, 1 INT',
    )
    expect(leaderStatText('mlb', 'Hitting', '2-4, HR, 2 RBI')).toBe('2-4, HR, 2 RBI')
  })

  it('falls back to the category itself for one it has no abbreviation for', () => {
    expect(leaderStatText('nba', 'Blocks Per Game', '3')).toBe('3 BLOCKS PER GAME')
    expect(leaderStatText('mlb', 'Batting Average', '.300')).toBe('.300 BATTING AVERAGE')
  })

  it('shows the bare value when there is no category to label it with', () => {
    expect(leaderStatText('nba', '', '24')).toBe('24')
  })
})
