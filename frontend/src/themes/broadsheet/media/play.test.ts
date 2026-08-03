import { describe, expect, it } from 'vitest'
import { playOptionsFor } from './play'

describe('playOptionsFor', () => {
  it('requests a radio continuation for a track', () => {
    const options = playOptionsFor({
      uri: 'u1',
      mediaType: 'track',
      name: 'Amber Hours',
      artist: 'The Night Shift',
    })
    expect(options.radio).toBe(true)
    expect(options.enqueueMode).toBe('play')
    expect(options.artist).toBe('The Night Shift')
  })

  it('does not request radio for a non-track item', () => {
    const options = playOptionsFor({ uri: 'u2', mediaType: 'playlist', name: 'Late Night Drive' })
    expect(options.radio).toBe(false)
  })

  it('maps missing optional fields to undefined rather than null', () => {
    const options = playOptionsFor({
      uri: 'u3',
      mediaType: 'album',
      name: 'Late Bloom',
      artist: null,
      imageUrl: null,
    })
    expect(options.artist).toBeUndefined()
    expect(options.imageUrl).toBeUndefined()
  })
})
