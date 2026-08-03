import { describe, expect, it, vi } from 'vitest'
import { buildShelfActionGroups } from './build-shelf-action-groups'

const track = {
  uri: 'spotify--x://track/1',
  mediaType: 'track',
  name: 'Galvanize',
  artist: 'The Chemical Brothers',
  artistUri: 'spotify--x://artist/1',
  album: 'Push The Button',
  albumUri: 'spotify--x://album/1',
  imageUrl: null,
}

const album = {
  uri: 'spotify--x://album/1',
  mediaType: 'album',
  name: 'Push The Button',
  artist: 'The Chemical Brothers',
  artistUri: 'spotify--x://artist/1',
  album: null,
  albumUri: null,
  imageUrl: null,
}

const artist = {
  uri: 'spotify--x://artist/1',
  mediaType: 'artist',
  name: 'The Chemical Brothers',
  artist: undefined,
  artistUri: null,
  album: null,
  albumUri: null,
  imageUrl: null,
}

const playlist = {
  uri: 'spotify--x://playlist/1',
  mediaType: 'playlist',
  name: 'Late Night Drive',
  artist: undefined,
  artistUri: null,
  album: null,
  albumUri: null,
  imageUrl: null,
}

describe('buildShelfActionGroups', () => {
  it('gives a track all four play actions plus both go-to actions', () => {
    const groups = buildShelfActionGroups({
      item: track,
      play: vi.fn(),
      navigate: vi.fn(),
      onClose: vi.fn(),
    })
    expect(groups[0].items.map((i) => i.label)).toEqual([
      'Play just this track',
      'Play radio from this',
      'Play next',
      'Add to queue',
    ])
    expect(groups[1].items.map((i) => i.label)).toEqual(['Go to artist', 'Go to album'])
  })

  it('drops "Play just this track" for an album — tapping the card already plays it as-is', () => {
    const groups = buildShelfActionGroups({
      item: album,
      play: vi.fn(),
      navigate: vi.fn(),
      onClose: vi.fn(),
    })
    expect(groups[0].items.map((i) => i.label)).toEqual([
      'Play radio from this',
      'Play next',
      'Add to queue',
    ])
  })

  it('offers only "Go to artist" for an album — "Go to album" on an album row is meaningless', () => {
    const groups = buildShelfActionGroups({
      item: album,
      play: vi.fn(),
      navigate: vi.fn(),
      onClose: vi.fn(),
    })
    expect(groups[1].items.map((i) => i.label)).toEqual(['Go to artist'])
  })

  it('offers three play actions and no go-to actions for an artist', () => {
    const groups = buildShelfActionGroups({
      item: artist,
      play: vi.fn(),
      navigate: vi.fn(),
      onClose: vi.fn(),
    })
    expect(groups[0].items.map((i) => i.label)).toEqual([
      'Play radio from this',
      'Play next',
      'Add to queue',
    ])
    expect(groups[1].items).toEqual([])
  })

  it('offers three play actions and no go-to actions for a playlist', () => {
    const groups = buildShelfActionGroups({
      item: playlist,
      play: vi.fn(),
      navigate: vi.fn(),
      onClose: vi.fn(),
    })
    expect(groups[0].items.map((i) => i.label)).toEqual([
      'Play radio from this',
      'Play next',
      'Add to queue',
    ])
    expect(groups[1].items).toEqual([])
  })

  it('"Play radio from this" plays with radio for a non-track item', () => {
    const play = vi.fn()
    const groups = buildShelfActionGroups({
      item: album,
      play,
      navigate: vi.fn(),
      onClose: vi.fn(),
    })
    groups[0].items[0].onSelect()
    expect(play).toHaveBeenCalledWith(
      album.uri,
      expect.objectContaining({ radio: true, enqueueMode: 'play' }),
    )
  })

  it('"Play next" and "Add to queue" use the matching enqueue mode', () => {
    const play = vi.fn()
    const groups = buildShelfActionGroups({
      item: playlist,
      play,
      navigate: vi.fn(),
      onClose: vi.fn(),
    })
    groups[0].items[1].onSelect()
    groups[0].items[2].onSelect()
    expect(play).toHaveBeenNthCalledWith(
      1,
      playlist.uri,
      expect.objectContaining({ enqueueMode: 'next' }),
    )
    expect(play).toHaveBeenNthCalledWith(
      2,
      playlist.uri,
      expect.objectContaining({ enqueueMode: 'add' }),
    )
  })

  it('"Go to artist" navigates to the URL-encoded artist route', () => {
    const navigate = vi.fn()
    const groups = buildShelfActionGroups({
      item: track,
      play: vi.fn(),
      navigate,
      onClose: vi.fn(),
    })
    const goToArtist = groups[1].items.find((i) => i.label === 'Go to artist')!
    goToArtist.onSelect()
    expect(navigate).toHaveBeenCalledWith(`/media/artist/${encodeURIComponent(track.artistUri)}`)
  })

  it('"Go to album" navigates to the URL-encoded album route', () => {
    const navigate = vi.fn()
    const groups = buildShelfActionGroups({
      item: track,
      play: vi.fn(),
      navigate,
      onClose: vi.fn(),
    })
    const goToAlbum = groups[1].items.find((i) => i.label === 'Go to album')!
    goToAlbum.onSelect()
    expect(navigate).toHaveBeenCalledWith(`/media/album/${encodeURIComponent(track.albumUri)}`)
  })

  it('calls onClose after every action', () => {
    const onClose = vi.fn()
    const groups = buildShelfActionGroups({
      item: track,
      play: vi.fn(),
      navigate: vi.fn(),
      onClose,
    })
    groups[0].items[0].onSelect()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
