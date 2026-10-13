import { describe, expect, it } from 'vitest'
import { buildStandfirst } from './standfirst'

describe('buildStandfirst', () => {
  it('names the next event when the day has one', () => {
    const text = buildStandfirst({
      eventCount: 2,
      nextEventTitle: 'Pick up kids',
      sports: { state: 'none' },
    })
    expect(text).toContain('Pick up kids')
  })

  it('says something graceful about an empty day rather than nothing', () => {
    const text = buildStandfirst({
      eventCount: 0,
      nextEventTitle: null,
      sports: { state: 'none' },
    })
    expect(text.length).toBeGreaterThan(20)
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('null')
  })

  it('mentions the game when one is live', () => {
    const text = buildStandfirst({
      eventCount: 0,
      nextEventTitle: null,
      sports: { state: 'live', league: 'mlb' },
    })
    expect(text.toLowerCase()).toMatch(/game|first pitch|underway/)
  })

  it.each([
    ['mlb', 'first pitch is later'],
    ['nba', 'tip-off is later'],
    ['nfl', 'kickoff is later'],
    ['nhl', 'puck drop is later'],
    ['mls', 'the game is later'],
  ])('words a %s pregame for its own sport', (league, clause) => {
    const text = buildStandfirst({
      eventCount: 0,
      nextEventTitle: null,
      sports: { state: 'pregame', league },
    })
    expect(text).toContain(clause)
  })

  it('is deterministic — same input, same prose', () => {
    const input = {
      eventCount: 3,
      nextEventTitle: 'Piano lesson',
      sports: { state: 'pregame', league: 'mlb' } as const,
    }
    expect(buildStandfirst(input)).toBe(buildStandfirst(input))
  })

  it('never ends without terminal punctuation', () => {
    for (const count of [0, 1, 5]) {
      const text = buildStandfirst({
        eventCount: count,
        nextEventTitle: count ? 'Something' : null,
        sports: { state: 'none' },
      })
      expect(text.trimEnd()).toMatch(/[.!?]$/)
    }
  })

  it('uses correct singular/plural form when eventCount is 1 with no title', () => {
    const text = buildStandfirst({
      eventCount: 1,
      nextEventTitle: null,
      sports: { state: 'none' },
    })
    expect(text).toContain('1 thing')
    expect(text).not.toContain('1 things')
  })
})
