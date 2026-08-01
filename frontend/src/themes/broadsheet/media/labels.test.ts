import { describe, expect, it } from 'vitest'
import { typeLabel } from './labels'

describe('typeLabel', () => {
  it('capitalises the media type', () => {
    expect(typeLabel('playlist')).toBe('Playlist')
    expect(typeLabel('album')).toBe('Album')
    expect(typeLabel('artist')).toBe('Artist')
    expect(typeLabel('track')).toBe('Track')
  })

  it('handles an empty string without throwing', () => {
    expect(typeLabel('')).toBe('')
  })
})
