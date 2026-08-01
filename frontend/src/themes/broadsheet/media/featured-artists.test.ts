import { describe, expect, it } from 'vitest'
import { featuredArtistsLabel } from './featured-artists'

describe('featuredArtistsLabel', () => {
  it('returns null for a track with only its own artist', () => {
    expect(featuredArtistsLabel([{ name: 'The Chemical Brothers', uri: 'a' }])).toBeNull()
  })

  it('returns null for an empty artist list', () => {
    expect(featuredArtistsLabel([])).toBeNull()
  })

  it('returns null when artists is missing entirely, not just empty (a real backend response has shown up without it)', () => {
    expect(featuredArtistsLabel(undefined)).toBeNull()
    expect(featuredArtistsLabel(null)).toBeNull()
  })

  it('names one featured artist, skipping the first credit', () => {
    const label = featuredArtistsLabel([
      { name: 'The Chemical Brothers', uri: 'a' },
      { name: 'Q-Tip', uri: 'b' },
    ])
    expect(label).toBe('Q-Tip')
  })

  it('joins multiple featured artists with a comma', () => {
    const label = featuredArtistsLabel([
      { name: 'The Chemical Brothers', uri: 'a' },
      { name: 'Q-Tip', uri: 'b' },
      { name: 'Tim Burgess', uri: 'c' },
    ])
    expect(label).toBe('Q-Tip, Tim Burgess')
  })
})
