import { describe, expect, it } from 'vitest'
import { formatMonthYear, shiftMonth } from './month-nav'

describe('shiftMonth', () => {
  it('moves forward a month within a year', () => {
    expect(shiftMonth(2026, 4, 1)).toEqual({ year: 2026, month: 5 })
  })

  it('moves backward a month within a year', () => {
    expect(shiftMonth(2026, 4, -1)).toEqual({ year: 2026, month: 3 })
  })

  it('rolls over into the next year from December', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 })
  })

  it('rolls back into the previous year from January', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 })
  })
})

describe('formatMonthYear', () => {
  it('formats as "Month Year"', () => {
    expect(formatMonthYear(2026, 4)).toBe('May 2026')
  })

  it('formats December correctly', () => {
    expect(formatMonthYear(2026, 11)).toBe('December 2026')
  })
})
