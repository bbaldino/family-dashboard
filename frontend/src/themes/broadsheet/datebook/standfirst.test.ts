import { describe, expect, it } from 'vitest'
import { buildDatebookStandfirst } from './standfirst'

describe('buildDatebookStandfirst', () => {
  it('says something graceful about an empty month rather than nothing', () => {
    const text = buildDatebookStandfirst({ eventCount: 0, nearestCountdown: null })
    expect(text.length).toBeGreaterThan(10)
    expect(text).not.toContain('undefined')
    expect(text).not.toContain('null')
    expect(text.trimEnd()).toMatch(/[.!?]$/)
  })

  it('uses correct singular/plural form for one event', () => {
    const text = buildDatebookStandfirst({ eventCount: 1, nearestCountdown: null })
    expect(text).toContain('1 thing')
    expect(text).not.toContain('1 things')
  })

  it('names the nearest countdown', () => {
    const text = buildDatebookStandfirst({
      eventCount: 62,
      nearestCountdown: { name: 'Last day of school', daysUntil: 13 },
    })
    expect(text).toContain('Last day of school')
    expect(text).toContain('13 days out')
  })

  it('says "today" for a countdown landing today', () => {
    const text = buildDatebookStandfirst({
      eventCount: 5,
      nearestCountdown: { name: 'Field trip', daysUntil: 0 },
    })
    expect(text).toContain('Field trip is today')
  })

  it('says "tomorrow" for a countdown one day out', () => {
    const text = buildDatebookStandfirst({
      eventCount: 5,
      nearestCountdown: { name: 'Recital', daysUntil: 1 },
    })
    expect(text).toContain('Recital is tomorrow')
  })

  it('omits the countdown clause when there is none', () => {
    const text = buildDatebookStandfirst({ eventCount: 8, nearestCountdown: null })
    expect(text).toBe('8 things on the calendar this month.')
  })

  it('is deterministic — same input, same prose', () => {
    const input = { eventCount: 12, nearestCountdown: { name: 'Wine walk', daysUntil: 4 } }
    expect(buildDatebookStandfirst(input)).toBe(buildDatebookStandfirst(input))
  })

  it('never ends without terminal punctuation', () => {
    for (const count of [0, 1, 62]) {
      const text = buildDatebookStandfirst({ eventCount: count, nearestCountdown: null })
      expect(text.trimEnd()).toMatch(/[.!?]$/)
    }
  })
})
