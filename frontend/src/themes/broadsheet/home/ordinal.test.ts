import { describe, expect, it } from 'vitest'
import { ordinalSuffix } from './ordinal'

describe('ordinalSuffix', () => {
  it('suffixes 1/2/3 as st/nd/rd', () => {
    expect(ordinalSuffix(1)).toBe('st')
    expect(ordinalSuffix(2)).toBe('nd')
    expect(ordinalSuffix(3)).toBe('rd')
  })

  it('suffixes everything else as th', () => {
    expect(ordinalSuffix(4)).toBe('th')
    expect(ordinalSuffix(7)).toBe('th')
    expect(ordinalSuffix(10)).toBe('th')
  })

  it('special-cases the 11/12/13 teens as th, not st/nd/rd', () => {
    expect(ordinalSuffix(11)).toBe('th')
    expect(ordinalSuffix(12)).toBe('th')
    expect(ordinalSuffix(13)).toBe('th')
  })

  it('resumes the normal pattern past the teens', () => {
    expect(ordinalSuffix(21)).toBe('st')
    expect(ordinalSuffix(22)).toBe('nd')
    expect(ordinalSuffix(23)).toBe('rd')
    expect(ordinalSuffix(24)).toBe('th')
  })

  it('handles the last days of a long month', () => {
    expect(ordinalSuffix(30)).toBe('th')
    expect(ordinalSuffix(31)).toBe('st')
  })
})
