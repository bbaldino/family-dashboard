import { describe, expect, it } from 'vitest'
import { fitWholeItems } from './coming-up-fit'

describe('fitWholeItems', () => {
  it('shows every item when the last one ends inside the room', () => {
    expect(fitWholeItems([20, 20, 41, 41, 62, 62], 100)).toBe(6)
  })

  it('drops a whole two-up row when its bottom passes the edge', () => {
    // Row three ends at 106 against a 100px edge: both its entries go together.
    expect(fitWholeItems([20, 20, 41, 41, 106, 106], 100)).toBe(4)
  })

  it('shows nothing when not even the first row fits', () => {
    expect(fitWholeItems([110, 110, 131, 131], 100)).toBe(0)
  })

  it('stops at the first item that does not fit, never skipping ahead', () => {
    expect(fitWholeItems([20, 120, 41], 100)).toBe(1)
  })

  it('tolerates sub-pixel rounding at the edge', () => {
    expect(fitWholeItems([100.3], 100)).toBe(1)
    expect(fitWholeItems([101], 100)).toBe(0)
  })

  it('shows nothing for no items', () => {
    expect(fitWholeItems([], 100)).toBe(0)
  })
})
