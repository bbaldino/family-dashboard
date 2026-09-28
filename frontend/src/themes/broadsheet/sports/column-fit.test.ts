import { describe, expect, it } from 'vitest'
import { fitLeadingCount } from './column-fit'

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
