import { describe, expect, it } from 'vitest'
import { buildArtistStandfirst } from './artist-standfirst'

describe('buildArtistStandfirst', () => {
  it('reads well with the real-world combination: populated genres, a null description', () => {
    // The Chemical Brothers — 4 genres.
    const text = buildArtistStandfirst({
      genres: ['breakbeat', 'big beat', 'electronic', 'electronica'],
      albumCount: 9,
    })
    expect(text).toBe('Breakbeat, big beat, electronic, electronica — 9 albums in the library.')
  })

  it('falls back to just the album clause when there are no genres', () => {
    const text = buildArtistStandfirst({ genres: [], albumCount: 2 })
    expect(text).toBe('2 albums in the library.')
  })

  it('uses singular "album" for one album', () => {
    const text = buildArtistStandfirst({ genres: ['synthwave'], albumCount: 1 })
    expect(text).toContain('1 album in the library')
    expect(text).not.toContain('1 albums')
  })

  it('says something graceful for zero albums rather than "0 albums"', () => {
    const text = buildArtistStandfirst({ genres: ['dream pop'], albumCount: 0 })
    expect(text).not.toContain('0 albums')
    expect(text.toLowerCase()).toContain('no albums')
  })

  it('is deterministic — same input, same prose', () => {
    const input = { genres: ['synthwave', 'dream pop'], albumCount: 3 }
    expect(buildArtistStandfirst(input)).toBe(buildArtistStandfirst(input))
  })

  it('never ends without terminal punctuation and never leaks undefined/null', () => {
    const cases = [
      { genres: [], albumCount: 0 },
      { genres: ['electronic'], albumCount: 9 },
    ]
    for (const input of cases) {
      const text = buildArtistStandfirst(input)
      expect(text.trimEnd()).toMatch(/[.!?]$/)
      expect(text).not.toContain('undefined')
      expect(text).not.toContain('null')
    }
  })
})
