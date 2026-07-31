import { describe, expect, it } from 'vitest'
import { buildStandfirst } from './standfirst'

describe('buildStandfirst', () => {
  it('names the next event when the day has one', () => {
    const text = buildStandfirst({
      eventCount: 2,
      nextEventTitle: 'Pick up kids',
      sportsState: 'none',
      lunchAvailable: false,
    })
    expect(text).toContain('Pick up kids')
  })

  it('says something graceful about an empty day rather than nothing', () => {
    const text = buildStandfirst({
      eventCount: 0,
      nextEventTitle: null,
      sportsState: 'none',
      lunchAvailable: false,
    })
    expect(text.length).toBeGreaterThan(20)
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('null')
  })

  it('mentions the game when one is live', () => {
    const text = buildStandfirst({
      eventCount: 0,
      nextEventTitle: null,
      sportsState: 'live',
      lunchAvailable: false,
    })
    expect(text.toLowerCase()).toMatch(/game|first pitch|underway/)
  })

  it('is deterministic — same input, same prose', () => {
    const input = {
      eventCount: 3,
      nextEventTitle: 'Piano lesson',
      sportsState: 'pregame' as const,
      lunchAvailable: true,
    }
    expect(buildStandfirst(input)).toBe(buildStandfirst(input))
  })

  it('never ends without terminal punctuation', () => {
    for (const count of [0, 1, 5]) {
      const text = buildStandfirst({
        eventCount: count,
        nextEventTitle: count ? 'Something' : null,
        sportsState: 'none',
        lunchAvailable: true,
      })
      expect(text.trimEnd()).toMatch(/[.!?]$/)
    }
  })

  it('uses correct singular/plural form when eventCount is 1 with no title', () => {
    const text = buildStandfirst({
      eventCount: 1,
      nextEventTitle: null,
      sportsState: 'none',
      lunchAvailable: false,
    })
    expect(text).toContain('1 thing')
    expect(text).not.toContain('1 things')
  })
})
