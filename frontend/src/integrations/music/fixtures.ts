/**
 * Named music states for `?scenario=<name>` (see `@/lib/scenario`), typed
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
 * do — look up `activeScenario` from `@/lib/scenario`, and fall through to
 * the normal fetch when it's `null` or not a scenario this integration
 * defines.
 */
import type { QueueState, SearchResults, TopTrack, RecentItem, Playlist } from './types'
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
        year: 2023,
        label: 'Harbor Sound Records',
        trackNumber: 1,
        source: 'spotify--yC8brUbw',
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
        // A local-library-style item: MA doesn't always carry these, so this
        // track is the fixture's example of that ordinary absence.
        year: null,
        label: null,
        trackNumber: 4,
        source: 'library',
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
    {
      queue_item_id: 'qi-1',
      position: 0,
      duration: 238,
      media_item: {
        name: 'Amber Hours',
        uri: PLAYING_TRACK_URI,
        media_type: 'track',
        artists: [{ name: 'The Night Shift' }],
      },
    },
    {
      queue_item_id: 'qi-2',
      position: 1,
      duration: 201,
      media_item: {
        name: 'Low Tide',
        uri: 'fixture://track/low-tide',
        media_type: 'track',
        artists: [{ name: 'The Night Shift' }],
      },
    },
    {
      queue_item_id: 'qi-3',
      position: 2,
      duration: 176,
      media_item: {
        name: 'Porch Light',
        uri: 'fixture://track/porch-light',
        media_type: 'track',
        artists: [{ name: 'The Night Shift' }],
      },
    },
    {
      queue_item_id: 'qi-4',
      position: 3,
      duration: 220,
      media_item: {
        name: 'Static Bloom',
        uri: 'fixture://track/static-bloom',
        media_type: 'track',
        artists: [{ name: 'Bellwether Coast' }],
      },
    },
  ]
}

const musicQueueItemFixtures: Record<MusicScenario, (queueId: string) => QueueItem[] | undefined> =
  {
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
    {
      name: 'Late Night Drive',
      description: 'Discover Weekly',
      uri: 'fixture://playlist/late-night-drive',
      image: null,
    },
    {
      name: 'Kitchen Radio',
      description: 'Release Radar',
      uri: 'fixture://playlist/kitchen-radio',
      image: null,
    },
    {
      name: 'Sunday Slow Mix',
      description: 'Daily Mix 1',
      uri: 'fixture://playlist/sunday-slow-mix',
      image: null,
    },
  ]
}

const musicForYouFixtures: Record<MusicScenario, () => CuratedPlaylist[]> = {
  empty: () => [],
  packed: packedForYou,
}

// ─── playlists ───────────────────────────────────────────────────

function packedPlaylists(): Playlist[] {
  // Eight, deliberately: the design's Playlists shelf fills the band the two
  // grids leave empty, so the fixture has to be deep enough to show it full.
  return [
    'Sunday Kitchen',
    'Late Shift',
    'Kids in the Car',
    'Dinner Party',
    'Slow Morning',
    'Road Trip',
    'Focus Deep',
    'Wind Down',
  ].map((name) => ({
    uri: `fixture://playlist/${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    // Null, per this file's artwork convention — the card's letter placeholder
    // is the common real case anyway, since MA carries absolute-URL art for
    // only a couple of the household's playlists. The art path is covered by
    // the component test's own inline fixture.
    image_url: null,
  }))
}

const musicPlaylistsFixtures: Record<MusicScenario, () => Playlist[]> = {
  empty: () => [],
  packed: packedPlaylists,
}

/** The `Playlist[]` fixture for `scenario`, or `undefined` if no scenario is
 *  active or it isn't one this integration defines. */
export function musicPlaylistsFixtureFor(scenario: string | null): Playlist[] | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  return musicPlaylistsFixtures[scenario]()
}

/** The curated-playlist `CuratedPlaylist[]` fixture for `scenario`, or
 *  `undefined` if no scenario is active or it isn't one this integration
 *  defines. */
export function musicForYouFixtureFor(scenario: string | null): CuratedPlaylist[] | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  return musicForYouFixtures[scenario]()
}

// ─── players ─────────────────────────────────────────────────────

// `fixture-kitchen` doubles as both the packed scenario's playing queue
// (`packedQueues` above) and the room-pill anchor — the household's real
// `music.default_player` names the Kitchen Sonos too (see the room-grouping
// brief), so this is the fixture's own analogue of that same anchor.
const BEDROOM_ID = 'fixture-bedroom'
const OFFICE_DISPLAY_ID = 'fixture-office-display'

function packedPlayers(): RawPlayer[] {
  return [
    {
      // The anchor. Already grouped with the Bedroom (`group_members`
      // includes both itself and the Bedroom — MA's leader-reported list
      // always includes the leader's own id, see PlayerPicker.tsx's own
      // comment on why that list, not `synced_to`, is the reliable
      // membership signal), and can additionally group with the Living
      // Room, which hasn't joined.
      player_id: KITCHEN_QUEUE_ID,
      display_name: 'Kitchen',
      state: 'playing',
      available: true,
      volume_level: 45,
      group_members: [KITCHEN_QUEUE_ID, BEDROOM_ID],
      synced_to: null,
      can_group_with: [LIVING_ROOM_QUEUE_ID, BEDROOM_ID],
      group_volume: 38,
    },
    {
      // A joinable room: can group with the anchor, hasn't yet.
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
    {
      // An already-joined room. `synced_to` is set too (unlike real MA,
      // which rarely populates it on followers — see PlayerPicker.tsx's
      // comment again) so this fixture also exercises that signal.
      player_id: BEDROOM_ID,
      display_name: 'Bedroom',
      state: 'playing',
      available: true,
      volume_level: 38,
      group_members: [],
      synced_to: KITCHEN_QUEUE_ID,
      can_group_with: [KITCHEN_QUEUE_ID],
      group_volume: null,
    },
    {
      // Can't group with the anchor at all — the fixture's analogue of the
      // household's real Chromecast displays, which report no groupable
      // players (see the room-grouping brief).
      player_id: OFFICE_DISPLAY_ID,
      display_name: 'Office Display',
      state: 'idle',
      available: true,
      volume_level: 50,
      group_members: [],
      synced_to: null,
      can_group_with: [],
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

// The room-pill anchor id for each scenario. `useRoomPills` otherwise reads
// the anchor from a *live* `/api/config` fetch (`music.default_player`) —
// the scenario mechanism doesn't touch that fetch at all, so under a
// scenario it would keep returning the household's real Sonos id, which
// never matches any of this file's `fixture-*` player ids. Without this,
// the pills silently render nothing (`resolveAnchorAndRooms` correctly
// finds no matching player) under every `?scenario=` — the fixture becomes
// unable to exercise the one thing it exists to test. `null` for `empty`:
// there's genuinely no anchor to offer when there are no players either.
const musicAnchorFixtures: Record<MusicScenario, () => string | null> = {
  empty: () => null,
  packed: () => KITCHEN_QUEUE_ID,
}

/** The room-pill anchor player id for `scenario`, or `undefined` if no
 *  scenario is active or it isn't one this integration defines — in which
 *  case `useRoomPills` should read the anchor from the real (live) config
 *  fetch exactly as it does today. Always a player id also present in
 *  `musicPlayersFixtureFor(scenario)`'s own list, so the two fixtures can
 *  never fall out of agreement the way the real config value and the
 *  fixture players did. */
export function musicAnchorFixtureFor(scenario: string | null): string | null | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  return musicAnchorFixtures[scenario]()
}

// ─── artist / album detail ─────────────────────────────────────────

// A featured-artist credit on the fixture's opening track — exercises the
// "feat. X" rendering the screens derive from `artists` beyond the first.
const FEATURED_ARTIST_URI = 'fixture://artist/sable-ko'

function nightShiftArtist(): ArtistDetail {
  return {
    name: 'The Night Shift',
    image_url: null,
    // Populated case: MA does carry genres for plenty of real artists.
    genres: ['synthwave', 'dream pop', 'electronic'],
    // Realistic null case: MA only enriches metadata for library items, and
    // this household's library is empty — every artist bio is null today.
    description: null,
    top_tracks: [
      {
        uri: PLAYING_TRACK_URI,
        name: 'Amber Hours',
        artist: 'The Night Shift',
        artist_uri: ARTIST_URI,
        artists: [
          { name: 'The Night Shift', uri: ARTIST_URI },
          { name: 'Sable Ko', uri: FEATURED_ARTIST_URI },
        ],
        album: 'Late Bloom',
        album_uri: ALBUM_URI,
        image_url: null,
        duration: 238,
      },
      {
        uri: 'fixture://track/low-tide',
        name: 'Low Tide',
        artist: 'The Night Shift',
        artist_uri: ARTIST_URI,
        artists: [{ name: 'The Night Shift', uri: ARTIST_URI }],
        album: 'Late Bloom',
        album_uri: ALBUM_URI,
        image_url: null,
        duration: 201,
      },
      {
        uri: 'fixture://track/porch-light',
        name: 'Porch Light',
        artist: 'The Night Shift',
        artist_uri: ARTIST_URI,
        artists: [{ name: 'The Night Shift', uri: ARTIST_URI }],
        album: 'Late Bloom',
        album_uri: ALBUM_URI,
        image_url: null,
        duration: 176,
      },
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
    // Populated case: matches the label already used for this same track in
    // packedQueues (fixture://track/amber-hours) — same fixture identity.
    label: 'Harbor Sound Records',
    // Realistic null case: MA only enriches metadata for library items, and
    // this household's library is empty — every album description is null today.
    description: null,
    tracks: [
      {
        uri: PLAYING_TRACK_URI,
        name: 'Amber Hours',
        artist: 'The Night Shift',
        artist_uri: ARTIST_URI,
        artists: [
          { name: 'The Night Shift', uri: ARTIST_URI },
          { name: 'Sable Ko', uri: FEATURED_ARTIST_URI },
        ],
        album: 'Late Bloom',
        album_uri: ALBUM_URI,
        image_url: null,
        duration: 238,
      },
      {
        uri: 'fixture://track/low-tide',
        name: 'Low Tide',
        artist: 'The Night Shift',
        artist_uri: ARTIST_URI,
        artists: [{ name: 'The Night Shift', uri: ARTIST_URI }],
        album: 'Late Bloom',
        album_uri: ALBUM_URI,
        image_url: null,
        duration: 201,
      },
      {
        uri: 'fixture://track/porch-light',
        name: 'Porch Light',
        artist: 'The Night Shift',
        artist_uri: ARTIST_URI,
        artists: [{ name: 'The Night Shift', uri: ARTIST_URI }],
        album: 'Late Bloom',
        album_uri: ALBUM_URI,
        image_url: null,
        duration: 176,
      },
      {
        uri: 'fixture://track/static-bloom',
        name: 'Static Bloom',
        artist: 'The Night Shift',
        artist_uri: ARTIST_URI,
        artists: [{ name: 'The Night Shift', uri: ARTIST_URI }],
        album: 'Late Bloom',
        album_uri: ALBUM_URI,
        image_url: null,
        duration: 220,
      },
    ],
  }
}

/** The `ArtistDetail` fixture for `scenario`/`uri`, or `undefined` if no
 *  scenario is active, it isn't one this integration defines, or `uri`
 *  isn't the fixture artist the rest of the music fixtures link to. */
export function musicArtistDetailFixtureFor(
  scenario: string | null,
  uri: string,
): ArtistDetail | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  if (scenario === 'empty') return undefined
  if (uri !== ARTIST_URI) return undefined
  return nightShiftArtist()
}

/** The `AlbumDetail` fixture for `scenario`/`uri`, or `undefined` if no
 *  scenario is active, it isn't one this integration defines, or `uri`
 *  isn't the fixture album the rest of the music fixtures link to. */
export function musicAlbumDetailFixtureFor(
  scenario: string | null,
  uri: string,
): AlbumDetail | undefined {
  if (!scenario || !isMusicScenario(scenario)) return undefined
  if (scenario === 'empty') return undefined
  if (uri !== ALBUM_URI) return undefined
  return lateBloomAlbum()
}
