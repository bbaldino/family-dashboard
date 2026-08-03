import { describe, expect, it } from 'vitest'
import { ALBUM_GRADIENT_PALETTE, gradientForName, initialsForName } from './album-art'

describe('gradientForName', () => {
  it('is deterministic — the same name always yields the same gradient', () => {
    const a = gradientForName('Amber Hours')
    const b = gradientForName('Amber Hours')
    expect(a).toEqual(b)
  })

  it('always returns a real palette entry', () => {
    const names = [
      'Amber Hours',
      '',
      'a',
      'The Night Shift',
      'Static Bloom',
      'Low Tide',
      '🎵',
      'x'.repeat(500),
    ]
    for (const name of names) {
      const gradient = gradientForName(name)
      expect(ALBUM_GRADIENT_PALETTE).toContainEqual(gradient)
    }
  })

  it('spreads distinct names across more than one palette entry', () => {
    const names = [
      'Amber Hours',
      'Low Tide',
      'Porch Light',
      'Static Bloom',
      'Harbor Lights',
      'Black Steel',
    ]
    const gradients = new Set(names.map((n) => gradientForName(n).join('|')))
    expect(gradients.size).toBeGreaterThan(1)
  })
})

describe('initialsForName', () => {
  it('takes the first letter of up to three words, uppercased', () => {
    expect(initialsForName('Heat Of The Moment')).toBe('HOT')
    expect(initialsForName('blue monday')).toBe('BM')
  })

  it('handles a single word', () => {
    expect(initialsForName('Tainted')).toBe('T')
  })

  it('handles an empty string without throwing', () => {
    expect(initialsForName('')).toBe('')
  })

  it('collapses repeated spaces rather than emitting blank initials', () => {
    expect(initialsForName('Amber  Hours')).toBe('AH')
  })
})
