/**
 * Named music states for `?scenario=<name>` (see `@/data/scenario`), typed
 * as the *real* return shapes of the music hooks — `QueueState`,
 * `SearchResults`, `TopTrack`, `RecentItem`, `RawPlayer`, `QueueItem`,
 * `AlbumDetail`, `ArtistDetail` — imported from their hook/type modules
 * rather than redeclared. If any of those shapes change, this file stops
 * compiling instead of silently drifting out of sync.
 *
 * Music Assistant is unreachable from this machine for the whole project,
 * so these are also the only way the media screens can be exercised at all
 * (see the media-data brief).
 *
 * Two scenarios:
 * - `empty`  — configured and connected, but nothing playing: no active
 *              queue, no search history, no players. Exercises every
 *              screen's "nothing here" state.
 * - `packed` — a playing queue and a paused one (so the active-queue
 *              derivation and the mini-player / now-playing surfaces all
 *              have something to show), a full search results page across
 *              all four `parseSearchResponse` buckets, populated quick
 *              dials, curated "for you" playlists, two players (one of
 *              them the active one), and the artist/album detail pages
 *              those items link to.
 *
 * Artwork: every fixture image field is `null`. The media screens already
 * render a Music-icon placeholder whenever an item has no artwork — a
 * legitimate, common real state (plenty of local or imported tracks carry
 * none) — so reusing that path needs no image asset, doesn't fake a URL
 * against the (currently unreachable) image proxy, and exercises the
 * "no artwork" rendering every card already has to handle correctly.
 *
 * To add a fixture set for another integration: write a sibling
 * `fixtures.ts`, export functions typed against the hook's real return
 * type, and have the hook check them the same way the hooks in this module
 * do — look up `activeScenario` from `@/data/scenario`, and fall through to
 * the normal fetch when it's `null` or not a scenario this integration
 * defines.
 */
import type { QueueState, SearchResults, TopTrack, RecentItem } from './types'
import type { RawPlayer } from './usePlayers'
import type { QueueItem } from './useQueue'
import type { AlbumDetail } from './useAlbumDetail'
import type { ArtistDetail } from './useArtistDetail'
import type { CuratedPlaylist } from './useForYou'

export type MusicScenario = 'empty' | 'packed'

function isMusicScenario(name: string): name is MusicScenario {
  return name === 'empty' || name === 'packed'
}

// ─── shared fixture identities ───────────────────────────────────
// Every cross-reference below (search results, quick dials, artist/album
// detail) points at these same two URIs, so navigating from any card lands
// on a detail page the fixtures actually cover.

const ARTIST_URI = 'fixture://artist/the-night-shift'
const ALBUM_URI = 'fixture://album/late-bloom'
const PLAYING_TRACK_URI = 'fixture://track/amber-hours'
const PAUSED_TRACK_URI = 'fixture://track/harbor-lights'
const KITCHEN_QUEUE_ID = 'fixture-kitchen'
const LIVING_ROOM_QUEUE_ID = 'fixture-living-room'

// ─── now playing / queue ──────────────────────────────────────────

function packedQueues(): QueueState[] {
  return [
    {
      queueId: KITCHEN_QUEUE_ID,
      displayName: 'Kitchen',
      state: 'playing',
      currentItem: {
        name: 'Amber Hours',
        artist: 'The Night Shift',
        album: 'Late Bloom',
        imageUrl: null,
        duration: 238,
        elapsed: 71,
        uri: PLAYING_TRACK_URI,
      },
      volumeLevel: 45,
    },
    {
      queueId: LIVING_ROOM_QUEUE_ID,
      displayName: 'Living Room',
      state: 'paused',
      currentItem: {
        name: 'Harbor Lights',
        artist: 'Bellwether Coast',
        album: 'Tideline',
        imageUrl: null,
        duration: 194,
        elapsed: 52,
        uri: PAUSED_TRACK_URI,
      },
      volumeLevel: 20,
    },
  ]
}

const musicStateFixtures: Record<MusicScenario, () => QueueState[]> = {
  empty: () => [],
  packed: packedQueues,
}

/** The `QueueState[]` fixture for `scenario` — the shape `MusicProvider`
 *  otherwise builds from its SSE stream — or `undefined` if no scenario is
 *  active or it isn't one this integration defines, in which case the
 *  provider should connect to Music Assistant as usual. */
export function musicStateFixtureFor(scenario: string | null): QueueState[] | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  return musicStateFixtures[scenario]()
}

function packedQueueItems(): QueueItem[] {
  return [
    { queue_item_id: 'qi-1', position: 0, media_item: { name: 'Amber Hours', uri: PLAYING_TRACK_URI, media_type: 'track', artists: [{ name: 'The Night Shift' }] } },
    { queue_item_id: 'qi-2', position: 1, media_item: { name: 'Low Tide', uri: 'fixture://track/low-tide', media_type: 'track', artists: [{ name: 'The Night Shift' }] } },
    { queue_item_id: 'qi-3', position: 2, media_item: { name: 'Porch Light', uri: 'fixture://track/porch-light', media_type: 'track', artists: [{ name: 'The Night Shift' }] } },
    { queue_item_id: 'qi-4', position: 3, media_item: { name: 'Static Bloom', uri: 'fixture://track/static-bloom', media_type: 'track', artists: [{ name: 'Bellwether Coast' }] } },
  ]
}

const musicQueueItemFixtures: Record<MusicScenario, (queueId: string) => QueueItem[] | undefined> = {
  empty: () => [],
  packed: (queueId) => (queueId === KITCHEN_QUEUE_ID ? packedQueueItems() : []),
}

/** The upcoming-items `QueueItem[]` fixture for `scenario`/`queueId` —
 *  `useQueue`'s real return shape — or `undefined` if no scenario is active
 *  or it isn't one this integration defines. */
export function musicQueueItemsFixtureFor(
  scenario: string | null,
  queueId: string | null | undefined,
): QueueItem[] | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  if (!queueId) return []
  return musicQueueItemFixtures[scenario](queueId)
}

// ─── search ────────────────────────────────────────────────────────

function packedSearch(): SearchResults {
  return {
    tracks: [
      {
        name: 'Amber Hours',
        uri: PLAYING_TRACK_URI,
        image: null,
        media_type: 'track',
        artist: 'The Night Shift',
        artist_uri: ARTIST_URI,
        album: 'Late Bloom',
        album_uri: ALBUM_URI,
      },
      {
        name: 'Low Tide',
        uri: 'fixture://track/low-tide',
        image: null,
        media_type: 'track',
        artist: 'The Night Shift',
        artist_uri: ARTIST_URI,
        album: 'Late Bloom',
        album_uri: ALBUM_URI,
      },
    ],
    artists: [
      {
        name: 'The Night Shift',
        uri: ARTIST_URI,
        image: null,
        media_type: 'artist',
      },
    ],
    albums: [
      {
        name: 'Late Bloom',
        uri: ALBUM_URI,
        image: null,
        media_type: 'album',
        artist: 'The Night Shift',
        artist_uri: ARTIST_URI,
      },
    ],
    playlists: [
      {
        name: 'Late Night Drive',
        uri: 'fixture://playlist/late-night-drive',
        image: null,
        media_type: 'playlist',
      },
    ],
  }
}

const emptySearch: SearchResults = { tracks: [], artists: [], albums: [], playlists: [] }

const musicSearchFixtures: Record<MusicScenario, () => SearchResults> = {
  empty: () => emptySearch,
  packed: packedSearch,
}

/** The `SearchResults` fixture for `scenario`, ignoring the query text
 *  itself (there's one canned result set), or `undefined` if no scenario is
 *  active or it isn't one this integration defines. */
export function musicSearchFixtureFor(scenario: string | null): SearchResults | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  return musicSearchFixtures[scenario]()
}

// ─── quick dials ───────────────────────────────────────────────────

function packedTopTracks(): TopTrack[] {
  return [
    {
      uri: PLAYING_TRACK_URI,
      name: 'Amber Hours',
      artist: 'The Night Shift',
      artist_uri: ARTIST_URI,
      album: 'Late Bloom',
      album_uri: ALBUM_URI,
      image_url: null,
      play_count: 42,
      last_played: Date.now() - 3 * 60 * 60 * 1000,
    },
    {
      uri: 'fixture://track/low-tide',
      name: 'Low Tide',
      artist: 'The Night Shift',
      artist_uri: ARTIST_URI,
      album: 'Late Bloom',
      album_uri: ALBUM_URI,
      image_url: null,
      play_count: 31,
      last_played: Date.now() - 26 * 60 * 60 * 1000,
    },
    {
      uri: PAUSED_TRACK_URI,
      name: 'Harbor Lights',
      artist: 'Bellwether Coast',
      artist_uri: null,
      album: 'Tideline',
      album_uri: null,
      image_url: null,
      play_count: 18,
      last_played: Date.now() - 4 * 24 * 60 * 60 * 1000,
    },
  ]
}

function packedRecent(): RecentItem[] {
  return [
    {
      name: 'Amber Hours',
      uri: PLAYING_TRACK_URI,
      image_url: null,
      media_type: 'track',
      artist: 'The Night Shift',
      artist_uri: ARTIST_URI,
      album: 'Late Bloom',
      album_uri: ALBUM_URI,
      last_played: Date.now() - 10 * 60 * 1000,
    },
    {
      name: 'Late Bloom',
      uri: ALBUM_URI,
      image_url: null,
      media_type: 'album',
      artist: 'The Night Shift',
      artist_uri: ARTIST_URI,
      last_played: Date.now() - 5 * 60 * 60 * 1000,
    },
    {
      name: 'Late Night Drive',
      uri: 'fixture://playlist/late-night-drive',
      image_url: null,
      media_type: 'playlist',
      last_played: Date.now() - 24 * 60 * 60 * 1000,
    },
  ]
}

const musicTopTracksFixtures: Record<MusicScenario, () => TopTrack[]> = {
  empty: () => [],
  packed: packedTopTracks,
}
const musicRecentFixtures: Record<MusicScenario, () => RecentItem[]> = {
  empty: () => [],
  packed: packedRecent,
}

/** The "Frequently Played" `TopTrack[]` fixture for `scenario`, or
 *  `undefined` if no scenario is active or it isn't one this integration
 *  defines. */
export function musicTopTracksFixtureFor(scenario: string | null): TopTrack[] | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  return musicTopTracksFixtures[scenario]()
}

/** The "Recently Played" `RecentItem[]` fixture for `scenario`, or
 *  `undefined` if no scenario is active or it isn't one this integration
 *  defines. */
export function musicRecentFixtureFor(scenario: string | null): RecentItem[] | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  return musicRecentFixtures[scenario]()
}

// ─── for you ─────────────────────────────────────────────────────

function packedForYou(): CuratedPlaylist[] {
  return [
    { name: 'Late Night Drive', description: 'Discover Weekly', uri: 'fixture://playlist/late-night-drive', image: null },
    { name: 'Kitchen Radio', description: 'Release Radar', uri: 'fixture://playlist/kitchen-radio', image: null },
    { name: 'Sunday Slow Mix', description: 'Daily Mix 1', uri: 'fixture://playlist/sunday-slow-mix', image: null },
  ]
}

const musicForYouFixtures: Record<MusicScenario, () => CuratedPlaylist[]> = {
  empty: () => [],
  packed: packedForYou,
}

/** The curated-playlist `CuratedPlaylist[]` fixture for `scenario`, or
 *  `undefined` if no scenario is active or it isn't one this integration
 *  defines. */
export function musicForYouFixtureFor(scenario: string | null): CuratedPlaylist[] | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  return musicForYouFixtures[scenario]()
}

// ─── players ─────────────────────────────────────────────────────

function packedPlayers(): RawPlayer[] {
  return [
    {
      player_id: KITCHEN_QUEUE_ID,
      display_name: 'Kitchen',
      state: 'playing',
      available: true,
      volume_level: 45,
      group_members: [],
      synced_to: null,
      can_group_with: [LIVING_ROOM_QUEUE_ID],
      group_volume: null,
    },
    {
      player_id: LIVING_ROOM_QUEUE_ID,
      display_name: 'Living Room',
      state: 'paused',
      available: true,
      volume_level: 20,
      group_members: [],
      synced_to: null,
      can_group_with: [KITCHEN_QUEUE_ID],
      group_volume: null,
    },
  ]
}

const musicPlayersFixtures: Record<MusicScenario, () => RawPlayer[]> = {
  empty: () => [],
  packed: packedPlayers,
}

/** The `RawPlayer[]` fixture for `scenario` — the raw, pre-`normalizePlayer`
 *  shape MA's `/players` endpoint returns — or `undefined` if no scenario is
 *  active or it isn't one this integration defines. */
export function musicPlayersFixtureFor(scenario: string | null): RawPlayer[] | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  return musicPlayersFixtures[scenario]()
}

// ─── artist / album detail ─────────────────────────────────────────

function nightShiftArtist(): ArtistDetail {
  return {
    name: 'The Night Shift',
    image_url: null,
    top_tracks: [
      { uri: PLAYING_TRACK_URI, name: 'Amber Hours', artist: 'The Night Shift', artist_uri: ARTIST_URI, album: 'Late Bloom', album_uri: ALBUM_URI, image_url: null, duration: 238 },
      { uri: 'fixture://track/low-tide', name: 'Low Tide', artist: 'The Night Shift', artist_uri: ARTIST_URI, album: 'Late Bloom', album_uri: ALBUM_URI, image_url: null, duration: 201 },
      { uri: 'fixture://track/porch-light', name: 'Porch Light', artist: 'The Night Shift', artist_uri: ARTIST_URI, album: 'Late Bloom', album_uri: ALBUM_URI, image_url: null, duration: 176 },
    ],
    albums: [
      { uri: ALBUM_URI, name: 'Late Bloom', image_url: null, year: 2023 },
      { uri: 'fixture://album/first-light', name: 'First Light', image_url: null, year: 2020 },
    ],
  }
}

function lateBloomAlbum(): AlbumDetail {
  return {
    name: 'Late Bloom',
    artist: 'The Night Shift',
    artist_uri: ARTIST_URI,
    image_url: null,
    year: 2023,
    tracks: [
      { uri: PLAYING_TRACK_URI, name: 'Amber Hours', artist: 'The Night Shift', artist_uri: ARTIST_URI, album: 'Late Bloom', album_uri: ALBUM_URI, image_url: null, duration: 238 },
      { uri: 'fixture://track/low-tide', name: 'Low Tide', artist: 'The Night Shift', artist_uri: ARTIST_URI, album: 'Late Bloom', album_uri: ALBUM_URI, image_url: null, duration: 201 },
      { uri: 'fixture://track/porch-light', name: 'Porch Light', artist: 'The Night Shift', artist_uri: ARTIST_URI, album: 'Late Bloom', album_uri: ALBUM_URI, image_url: null, duration: 176 },
      { uri: 'fixture://track/static-bloom', name: 'Static Bloom', artist: 'The Night Shift', artist_uri: ARTIST_URI, album: 'Late Bloom', album_uri: ALBUM_URI, image_url: null, duration: 220 },
    ],
  }
}

/** The `ArtistDetail` fixture for `scenario`/`uri`, or `undefined` if no
 *  scenario is active, it isn't one this integration defines, or `uri`
 *  isn't the fixture artist the rest of the music fixtures link to. */
export function musicArtistDetailFixtureFor(scenario: string | null, uri: string): ArtistDetail | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  if (scenario === 'empty') return undefined
  if (uri !== ARTIST_URI) return undefined
  return nightShiftArtist()
}

/** The `AlbumDetail` fixture for `scenario`/`uri`, or `undefined` if no
 *  scenario is active, it isn't one this integration defines, or `uri`
 *  isn't the fixture album the rest of the music fixtures link to. */
export function musicAlbumDetailFixtureFor(scenario: string | null, uri: string): AlbumDetail | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  if (scenario === 'empty') return undefined
  if (uri !== ALBUM_URI) return undefined
  return lateBloomAlbum()
}
