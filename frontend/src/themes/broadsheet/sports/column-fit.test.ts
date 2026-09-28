import { describe, expect, it } from 'vitest'
import { fitBriefCount, fitLeadingCount } from './column-fit'

describe('fitLeadingCount', () => {
  it('counts the leading blocks that fit whole', () => {
    expect(fitLeadingCount([100, 80, 60], 200)).toBe(2)
    expect(fitLeadingCount([100, 80, 60], 240)).toBe(3)
  })
  it('shows nothing when even the first does not fit', () => {
    expect(fitLeadingCount([120, 10], 100)).toBe(0)
  })
  it('never skips a big block to fit a smaller one after it', () => {
    expect(fitLeadingCount([50, 200, 10], 100)).toBe(1)
  })
})

describe('fitBriefCount', () => {
  it('shows every candidate that fits, with no "+N more" when none are left over', () => {
    // 3 items of 50 in 150: all fit, and nothing is left for a "+N more".
    expect(fitBriefCount([50, 50, 50], 150, 20, 3)).toBe(3)
  })
  it('reserves room for the "+N more" line whenever items are held back', () => {
    // 3 of 5 would take 150 exactly, but the 2 held back need a 20px line.
    expect(fitBriefCount([50, 50, 50], 150, 20, 5)).toBe(2)
    expect(fitBriefCount([50, 50, 50], 170, 20, 5)).toBe(3)
  })
  it('counts a taller dek-carrying item at its own height, in order', () => {
    expect(fitBriefCount([97, 97, 59, 59], 260, 19, 10)).toBe(2)
    expect(fitBriefCount([97, 97, 59, 59], 300, 19, 10)).toBe(3)
  })
  it('shows nothing when even the first item and the "+N more" line do not fit', () => {
    expect(fitBriefCount([97], 50, 19, 4)).toBe(0)
  })
})
