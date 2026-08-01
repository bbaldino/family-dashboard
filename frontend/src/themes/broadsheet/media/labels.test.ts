import { describe, expect, it } from 'vitest'
import { typeLabel, sourceLabel } from './labels'

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

describe('sourceLabel', () => {
  it('keeps only the provider name, capitalised, from a provider--instance id', () => {
    expect(sourceLabel('spotify--yC8brUbw')).toBe('Spotify')
  })

  it('capitalises a bare provider id with no instance suffix', () => {
    expect(sourceLabel('library')).toBe('Library')
  })

  it('returns null for null, undefined, and empty source', () => {
    expect(sourceLabel(null)).toBeNull()
    expect(sourceLabel(undefined)).toBeNull()
    expect(sourceLabel('')).toBeNull()
  })
})
