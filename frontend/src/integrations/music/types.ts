export interface TrackInfo {
  name: string
  artist: string
  album: string | null
  imageUrl: string | null
  duration: number | null // seconds
  elapsed: number | null // seconds
  uri: string | null
}

export interface TopTrack {
  uri: string
  name: string
  artist: string
  artist_uri?: string | null
  album: string | null
  album_uri?: string | null
  image_url: string | null
  play_count: number
  last_played: number
}

export interface QueueState {
  queueId: string
  displayName: string
  state: 'playing' | 'paused' | 'idle'
  currentItem: TrackInfo | null
  volumeLevel: number | null
}

export interface MusicState {
  queues: QueueState[]
  activeQueue: QueueState | null // the queue that's playing or was most recently active
}

export interface Player {
  playerId: string
  displayName: string
  state: string
  available: boolean
  volumeLevel: number | null
  /** Player IDs synced into this player's group (only populated on the leader). */
  groupMembers: string[]
  /** Leader's player ID this player is synced to (only populated on followers). */
  syncedTo: string | null
  /** Other player IDs this player can be grouped with. */
  canGroupWith: string[]
  /** The group's combined volume when this player is a leader. */
  groupVolume: number | null
}

export interface SearchResults {
  artists: SearchItem[]
  albums: SearchItem[]
  tracks: SearchItem[]
  playlists: SearchItem[]
}

export interface SearchItem {
  name: string
  uri: string
  image?: { path: string } | string | null
  artist?: string // for tracks/albums
  artist_uri?: string | null
  album?: string | null
  album_uri?: string | null
  media_type: string
}

export interface RecentItem {
  name: string
  uri: string
  /** Direct image URL from our explicit-play log. */
  image_url?: string | null
  media_type: string // "playlist", "track", "album", "artist"
  artist?: string
  artist_uri?: string | null
  album?: string | null
  album_uri?: string | null
  last_played?: number
}
