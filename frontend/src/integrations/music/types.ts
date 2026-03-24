export interface TrackInfo {
  name: string
  artist: string
  album: string | null
  imageUrl: string | null
  duration: number | null // seconds
  elapsed: number | null // seconds
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
  media_type: string
}

export interface RecentItem {
  name: string
  uri: string
  image?: { path: string } | string | null
  media_type: string // "playlist", "track", "album", "artist"
  artist?: string
}
