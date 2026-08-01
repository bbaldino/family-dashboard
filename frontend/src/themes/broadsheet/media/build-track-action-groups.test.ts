import { describe, expect, it, vi } from 'vitest'
import { buildTrackActionGroups } from './build-track-action-groups'

const track = {
  uri: 'spotify--x://track/1',
  name: 'Galvanize',
  artist: 'The Chemical Brothers',
  artist_uri: 'spotify--x://artist/1',
  artists: [{ name: 'The Chemical Brothers', uri: 'spotify--x://artist/1' }],
  album: 'Push The Button',
  album_uri: 'spotify--x://album/1',
  image_url: null,
  duration: 393,
}

describe('buildTrackActionGroups', () => {
  it('builds four play actions and two nav actions when both URIs are present', () => {
    const groups = buildTrackActionGroups({ track, play: vi.fn(), navigate: vi.fn(), onClose: vi.fn() })
    expect(groups[0].items.map((i) => i.label)).toEqual(['Play just this track', 'Play radio from this', 'Play next', 'Add to queue'])
    expect(groups[1].items.map((i) => i.label)).toEqual(['Go to artist', 'Go to album'])
  })

  it('omits "Go to artist" when artist_uri is null', () => {
    const groups = buildTrackActionGroups({ track: { ...track, artist_uri: null }, play: vi.fn(), navigate: vi.fn(), onClose: vi.fn() })
    expect(groups[1].items.map((i) => i.label)).toEqual(['Go to album'])
  })

  it('omits "Go to album" when album_uri is null', () => {
    const groups = buildTrackActionGroups({ track: { ...track, album_uri: null }, play: vi.fn(), navigate: vi.fn(), onClose: vi.fn() })
    expect(groups[1].items.map((i) => i.label)).toEqual(['Go to artist'])
  })

  it('"Play just this track" plays without radio', () => {
    const play = vi.fn()
    const groups = buildTrackActionGroups({ track, play, navigate: vi.fn(), onClose: vi.fn() })
    groups[0].items[0].onSelect()
    expect(play).toHaveBeenCalledWith(track.uri, expect.objectContaining({ radio: false, enqueueMode: 'play' }))
  })

  it('"Play radio from this" plays with radio', () => {
    const play = vi.fn()
    const groups = buildTrackActionGroups({ track, play, navigate: vi.fn(), onClose: vi.fn() })
    groups[0].items[1].onSelect()
    expect(play).toHaveBeenCalledWith(track.uri, expect.objectContaining({ radio: true, enqueueMode: 'play' }))
  })

  it('"Play next" and "Add to queue" use the matching enqueue mode', () => {
    const play = vi.fn()
    const groups = buildTrackActionGroups({ track, play, navigate: vi.fn(), onClose: vi.fn() })
    groups[0].items[2].onSelect()
    groups[0].items[3].onSelect()
    expect(play).toHaveBeenNthCalledWith(1, track.uri, expect.objectContaining({ enqueueMode: 'next' }))
    expect(play).toHaveBeenNthCalledWith(2, track.uri, expect.objectContaining({ enqueueMode: 'add' }))
  })

  it('"Go to artist" navigates to the URL-encoded artist route', () => {
    const navigate = vi.fn()
    const groups = buildTrackActionGroups({ track, play: vi.fn(), navigate, onClose: vi.fn() })
    const goToArtist = groups[1].items.find((i) => i.label === 'Go to artist')!
    goToArtist.onSelect()
    expect(navigate).toHaveBeenCalledWith(`/media/artist/${encodeURIComponent(track.artist_uri)}`)
  })

  it('"Go to album" navigates to the URL-encoded album route', () => {
    const navigate = vi.fn()
    const groups = buildTrackActionGroups({ track, play: vi.fn(), navigate, onClose: vi.fn() })
    const goToAlbum = groups[1].items.find((i) => i.label === 'Go to album')!
    goToAlbum.onSelect()
    expect(navigate).toHaveBeenCalledWith(`/media/album/${encodeURIComponent(track.album_uri)}`)
  })

  it('calls onClose after every action', () => {
    const onClose = vi.fn()
    const groups = buildTrackActionGroups({ track, play: vi.fn(), navigate: vi.fn(), onClose })
    groups[0].items[0].onSelect()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
