import { describe, expect, it } from 'vitest'
import {
  musicStateFixtureFor,
  musicQueueItemsFixtureFor,
  musicSearchFixtureFor,
  musicTopTracksFixtureFor,
  musicRecentFixtureFor,
  musicForYouFixtureFor,
  musicPlayersFixtureFor,
  musicArtistDetailFixtureFor,
  musicAlbumDetailFixtureFor,
} from './fixtures'

describe('musicStateFixtureFor', () => {
  it('returns undefined when no scenario is active', () => {
    expect(musicStateFixtureFor(null)).toBeUndefined()
  })

  it('returns undefined for a scenario this integration does not define', () => {
    expect(musicStateFixtureFor('live-game')).toBeUndefined()
  })

  it('empty scenario has no queues', () => {
    expect(musicStateFixtureFor('empty')).toEqual([])
  })

  it('packed scenario has one playing queue and one paused queue', () => {
    const queues = musicStateFixtureFor('packed')!
    expect(queues.map((q) => q.state).sort()).toEqual(['paused', 'playing'])
    expect(queues.every((q) => q.currentItem !== null)).toBe(true)
  })

  it('packed scenario artwork is null everywhere, relying on the built-in placeholder', () => {
    const queues = musicStateFixtureFor('packed')!
    expect(queues.every((q) => q.currentItem?.imageUrl === null)).toBe(true)
  })
})

describe('musicQueueItemsFixtureFor', () => {
  it('returns undefined when no scenario is active or is not defined', () => {
    expect(musicQueueItemsFixtureFor(null, 'fixture-kitchen')).toBeUndefined()
    expect(musicQueueItemsFixtureFor('live-game', 'fixture-kitchen')).toBeUndefined()
  })

  it('returns the upcoming items for the playing queue, including the current track', () => {
    const items = musicQueueItemsFixtureFor('packed', 'fixture-kitchen')!
    expect(items.length).toBeGreaterThan(1)
    expect(items[0].media_item.uri).toBe('fixture://track/amber-hours')
  })

  it('returns an empty list for a queue id the fixture does not know about', () => {
    expect(musicQueueItemsFixtureFor('packed', 'some-other-queue')).toEqual([])
  })

  it('returns an empty list when queueId is null', () => {
    expect(musicQueueItemsFixtureFor('packed', null)).toEqual([])
  })
})

describe('musicSearchFixtureFor', () => {
  it('returns undefined when no scenario is active or is not defined', () => {
    expect(musicSearchFixtureFor(null)).toBeUndefined()
    expect(musicSearchFixtureFor('live-game')).toBeUndefined()
  })

  it('empty scenario has no results in any bucket', () => {
    const results = musicSearchFixtureFor('empty')!
    expect(results).toEqual({ tracks: [], artists: [], albums: [], playlists: [] })
  })

  it('packed scenario has at least one result in every parseSearchResponse bucket', () => {
    const results = musicSearchFixtureFor('packed')!
    expect(results.tracks.length).toBeGreaterThan(0)
    expect(results.artists.length).toBeGreaterThan(0)
    expect(results.albums.length).toBeGreaterThan(0)
    expect(results.playlists.length).toBeGreaterThan(0)
  })
})

describe('musicTopTracksFixtureFor / musicRecentFixtureFor', () => {
  it('return undefined when no scenario is active or is not defined', () => {
    expect(musicTopTracksFixtureFor(null)).toBeUndefined()
    expect(musicRecentFixtureFor('live-game')).toBeUndefined()
  })

  it('empty scenario has nothing to show in either dial', () => {
    expect(musicTopTracksFixtureFor('empty')).toEqual([])
    expect(musicRecentFixtureFor('empty')).toEqual([])
  })

  it('packed scenario populates both dials', () => {
    expect(musicTopTracksFixtureFor('packed')!.length).toBeGreaterThan(0)
    expect(musicRecentFixtureFor('packed')!.length).toBeGreaterThan(0)
  })

  it('recent items cover more than one media type, matching what the real /recent feed mixes', () => {
    const recent = musicRecentFixtureFor('packed')!
    const types = new Set(recent.map((r) => r.media_type))
    expect(types.size).toBeGreaterThan(1)
  })
})

describe('musicForYouFixtureFor', () => {
  it('returns undefined when no scenario is active or is not defined', () => {
    expect(musicForYouFixtureFor(null)).toBeUndefined()
  })

  it('empty scenario has no curated playlists', () => {
    expect(musicForYouFixtureFor('empty')).toEqual([])
  })

  it('packed scenario has curated playlists', () => {
    expect(musicForYouFixtureFor('packed')!.length).toBeGreaterThan(0)
  })
})

describe('musicPlayersFixtureFor', () => {
  it('returns undefined when no scenario is active or is not defined', () => {
    expect(musicPlayersFixtureFor(null)).toBeUndefined()
  })

  it('empty scenario has no players', () => {
    expect(musicPlayersFixtureFor('empty')).toEqual([])
  })

  it('packed scenario has a couple of speakers, one of them active/playing', () => {
    const players = musicPlayersFixtureFor('packed')!
    expect(players.length).toBeGreaterThanOrEqual(2)
    expect(players.some((p) => p.state === 'playing')).toBe(true)
  })

  // The room-grouping brief's four required roles: an anchor, a joinable
  // room, an already-joined room, and a room that can't group at all —
  // otherwise there's no way to exercise every pill state broadsheet's
  // room pills need to render (see useRoomPills.test.tsx).
  it('packed scenario has an anchor (Kitchen) grouped with the Bedroom and groupable with the Living Room', () => {
    const players = musicPlayersFixtureFor('packed')!
    const kitchen = players.find((p) => p.display_name === 'Kitchen')!
    expect(kitchen.can_group_with).toContain(
      players.find((p) => p.display_name === 'Living Room')!.player_id,
    )
    expect(kitchen.group_members).toContain(
      players.find((p) => p.display_name === 'Bedroom')!.player_id,
    )
  })

  it('packed scenario has a joinable room (Living Room) that has not joined the anchor', () => {
    const players = musicPlayersFixtureFor('packed')!
    const kitchen = players.find((p) => p.display_name === 'Kitchen')!
    const livingRoom = players.find((p) => p.display_name === 'Living Room')!
    expect(livingRoom.can_group_with).toContain(kitchen.player_id)
    expect(kitchen.group_members).not.toContain(livingRoom.player_id)
  })

  it('packed scenario has an already-joined room (Bedroom) readable via both group_members and synced_to', () => {
    const players = musicPlayersFixtureFor('packed')!
    const kitchen = players.find((p) => p.display_name === 'Kitchen')!
    const bedroom = players.find((p) => p.display_name === 'Bedroom')!
    expect(kitchen.group_members).toContain(bedroom.player_id)
    expect(bedroom.synced_to).toBe(kitchen.player_id)
  })

  it('packed scenario has a room that cannot group with the anchor at all', () => {
    const players = musicPlayersFixtureFor('packed')!
    const kitchen = players.find((p) => p.display_name === 'Kitchen')!
    const officeDisplay = players.find((p) => p.display_name === 'Office Display')!
    expect(officeDisplay.can_group_with).toEqual([])
    expect(kitchen.can_group_with).not.toContain(officeDisplay.player_id)
  })
})

describe('musicArtistDetailFixtureFor / musicAlbumDetailFixtureFor', () => {
  it('return undefined when no scenario is active or is not defined', () => {
    expect(musicArtistDetailFixtureFor(null, 'fixture://artist/the-night-shift')).toBeUndefined()
    expect(musicAlbumDetailFixtureFor('live-game', 'fixture://album/late-bloom')).toBeUndefined()
  })

  it('empty scenario has no detail pages to show (nothing to navigate to)', () => {
    expect(musicArtistDetailFixtureFor('empty', 'fixture://artist/the-night-shift')).toBeUndefined()
    expect(musicAlbumDetailFixtureFor('empty', 'fixture://album/late-bloom')).toBeUndefined()
  })

  it('packed scenario returns undefined for a uri that is not the fixture artist/album', () => {
    expect(musicArtistDetailFixtureFor('packed', 'spotify://artist/unknown')).toBeUndefined()
    expect(musicAlbumDetailFixtureFor('packed', 'spotify://album/unknown')).toBeUndefined()
  })

  it('packed scenario returns the fixture artist for its own uri, with tracks pointing back at the fixture album', () => {
    const artist = musicArtistDetailFixtureFor('packed', 'fixture://artist/the-night-shift')!
    expect(artist.name).toBe('The Night Shift')
    expect(artist.top_tracks.length).toBeGreaterThan(0)
    expect(artist.top_tracks.every((t) => t.album_uri === 'fixture://album/late-bloom')).toBe(true)
  })

  it('packed scenario returns the fixture album for its own uri, with tracks pointing back at the fixture artist', () => {
    const album = musicAlbumDetailFixtureFor('packed', 'fixture://album/late-bloom')!
    expect(album.name).toBe('Late Bloom')
    expect(album.tracks.length).toBeGreaterThan(0)
    expect(album.tracks.every((t) => t.artist_uri === 'fixture://artist/the-night-shift')).toBe(true)
  })

  it('packed artist has genres populated but no bio, the realistic case for this household', () => {
    const artist = musicArtistDetailFixtureFor('packed', 'fixture://artist/the-night-shift')!
    expect(artist.genres.length).toBeGreaterThan(0)
    expect(artist.description).toBeNull()
  })

  it('packed album has a label but no description, the realistic case for this household', () => {
    const album = musicAlbumDetailFixtureFor('packed', 'fixture://album/late-bloom')!
    expect(album.label).not.toBeNull()
    expect(album.description).toBeNull()
  })

  it('packed album/artist opening track carries a featured artist beyond the first', () => {
    const album = musicAlbumDetailFixtureFor('packed', 'fixture://album/late-bloom')!
    const opener = album.tracks[0]
    expect(opener.artists.length).toBeGreaterThan(1)
    expect(opener.artists[0].name).toBe(opener.artist)
    expect(opener.artists.slice(1).map((a) => a.name)).toEqual(['Sable Ko'])
  })
})
