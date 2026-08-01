import { describe, expect, it } from 'vitest'
import { trackPlayOptions } from './track-play'

const track = {
  name: 'Galvanize',
  artist: 'The Chemical Brothers',
  artist_uri: 'spotify--x://artist/1',
  album: 'Push The Button',
  album_uri: 'spotify--x://album/1',
  image_url: 'https://example.com/cover.jpg',
}

describe('trackPlayOptions', () => {
  it('maps "play just this track" to radio false, enqueueMode play', () => {
    const opts = trackPlayOptions(track, { radio: false, enqueueMode: 'play' })
    expect(opts.radio).toBe(false)
    expect(opts.enqueueMode).toBe('play')
  })

  it('maps "play radio from this" to radio true, enqueueMode play', () => {
    const opts = trackPlayOptions(track, { radio: true, enqueueMode: 'play' })
    expect(opts.radio).toBe(true)
    expect(opts.enqueueMode).toBe('play')
  })

  it('maps "play next" to radio false, enqueueMode next', () => {
    const opts = trackPlayOptions(track, { radio: false, enqueueMode: 'next' })
    expect(opts.enqueueMode).toBe('next')
  })

  it('maps "add to queue" to radio false, enqueueMode add', () => {
    const opts = trackPlayOptions(track, { radio: false, enqueueMode: 'add' })
    expect(opts.enqueueMode).toBe('add')
  })

  it('carries display metadata through for the recently-played log', () => {
    const opts = trackPlayOptions(track, { radio: false, enqueueMode: 'play' })
    expect(opts.mediaType).toBe('track')
    expect(opts.name).toBe('Galvanize')
    expect(opts.artist).toBe('The Chemical Brothers')
    expect(opts.artistUri).toBe('spotify--x://artist/1')
    expect(opts.album).toBe('Push The Button')
    expect(opts.albumUri).toBe('spotify--x://album/1')
    expect(opts.imageUrl).toBe('https://example.com/cover.jpg')
  })

  it('turns nulls into undefined rather than passing them through', () => {
    const opts = trackPlayOptions(
      { ...track, artist: null, artist_uri: null, album: null, album_uri: null, image_url: null },
      { radio: false, enqueueMode: 'play' },
    )
    expect(opts.artist).toBeUndefined()
    expect(opts.artistUri).toBeUndefined()
    expect(opts.album).toBeUndefined()
    expect(opts.albumUri).toBeUndefined()
    expect(opts.imageUrl).toBeUndefined()
  })
})
