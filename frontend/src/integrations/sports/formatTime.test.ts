import { describe, expect, it } from 'vitest'
import { formatFinalDate } from './formatTime'

// The suite pins TZ to America/Los_Angeles (`vite.config.ts`), so these
// assertions are about a fixed zone rather than the machine's.
describe('formatFinalDate', () => {
  it('names the weekday and date of the game', () => {
    expect(formatFinalDate('2026-08-09T20:10:00Z')).toBe('Sun, Aug 9')
  })

  // The case that matters on a Pacific evening: 02:10Z on the 11th is 7:10pm
  // on the 10th locally. Rendering the UTC date would file a Monday night
  // game under Tuesday, and saying which day the game was is the whole reason
  // the strip carries a date.
  it('uses the local day, not the UTC one', () => {
    expect(formatFinalDate('2026-08-11T02:10:00Z')).toBe('Mon, Aug 10')
  })

  it('returns an empty string rather than the words "Invalid Date"', () => {
    expect(formatFinalDate('not a date')).toBe('')
  })
})
