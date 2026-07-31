import { describe, expect, it } from 'vitest'
import { parseSearchResponse } from './search'

describe('parseSearchResponse', () => {
  it('normalizes a Music Assistant response into per-media-type buckets', () => {
    const results = parseSearchResponse({
      tracks: [
        {
          name: 'Go',
          uri: 'spotify://track/1',
          media_type: 'track',
          image: { path: 'http://ma/track.jpg' },
          artists: [{ name: 'The Chemical Brothers', uri: 'spotify://artist/9' }],
          album: { name: 'Further', uri: 'spotify://album/4' },
        },
      ],
      playlists: [{ name: 'Discover Weekly', uri: 'spotify://playlist/2' }],
      artists: [],
      albums: [],
    })

    expect(results.tracks).toEqual([
      {
        name: 'Go',
        uri: 'spotify://track/1',
        image: 'http://ma/track.jpg',
        media_type: 'track',
        artist: 'The Chemical Brothers',
        artist_uri: 'spotify://artist/9',
        album: 'Further',
        album_uri: 'spotify://album/4',
      },
    ])
    expect(results.playlists).toHaveLength(1)
    expect(results.playlists[0].name).toBe('Discover Weekly')
  })

  it('prefers a direct image over the one nested in metadata', () => {
    const { albums } = parseSearchResponse({
      albums: [
        {
          name: 'Further',
          uri: 'spotify://album/4',
          image: { path: 'http://ma/direct.jpg' },
          metadata: { images: [{ path: 'http://ma/nested.jpg' }] },
        },
      ],
    })

    expect(albums[0].image).toBe('http://ma/direct.jpg')
  })

  it('falls back to the metadata image when no direct image is present', () => {
    const { albums } = parseSearchResponse({
      albums: [
        {
          name: 'Further',
          uri: 'spotify://album/4',
          metadata: { images: [{ path: 'http://ma/nested.jpg' }] },
        },
      ],
    })

    expect(albums[0].image).toBe('http://ma/nested.jpg')
  })

  it('fills in defaults for missing fields rather than emitting undefined', () => {
    const { tracks } = parseSearchResponse({ tracks: [{}] })

    expect(tracks[0]).toEqual({
      name: '',
      uri: '',
      image: null,
      media_type: '',
      artist: undefined,
      artist_uri: null,
      album: null,
      album_uri: null,
    })
  })

  it('returns empty buckets for absent, null, or non-array payloads', () => {
    const empty = { tracks: [], artists: [], albums: [], playlists: [] }

    expect(parseSearchResponse({})).toEqual(empty)
    expect(parseSearchResponse(null)).toEqual(empty)
    expect(parseSearchResponse(undefined)).toEqual(empty)
    expect(parseSearchResponse({ tracks: 'nope' })).toEqual(empty)
  })
})
