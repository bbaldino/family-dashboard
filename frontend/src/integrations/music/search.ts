import type { SearchItem, SearchResults } from './types'

/**
 * Raw shape returned by the Music Assistant search endpoint. The backend passes
 * MA's response through untouched (apart from rewriting image URLs), so every
 * field is optional from our side.
 */
interface RawSearchItem {
  name?: string
  uri?: string
  image?: { path?: string } | null
  metadata?: { images?: Array<{ path?: string }> }
  media_type?: string
  artists?: Array<{ name?: string; uri?: string }>
  album?: { name?: string; uri?: string } | null
}

function getItemImage(raw: RawSearchItem): string | null {
  if (raw.image?.path) return raw.image.path
  if (raw.metadata?.images?.[0]?.path) return raw.metadata.images[0].path
  return null
}

function normalizeItem(raw: RawSearchItem): SearchItem {
  return {
    name: raw.name ?? '',
    uri: raw.uri ?? '',
    image: getItemImage(raw),
    media_type: raw.media_type ?? '',
    artist: raw.artists?.[0]?.name,
    artist_uri: raw.artists?.[0]?.uri ?? null,
    album: raw.album?.name ?? null,
    album_uri: raw.album?.uri ?? null,
  }
}

/** Normalize a raw `/search` response into typed, per-media-type buckets. */
export function parseSearchResponse(data: unknown): SearchResults {
  const obj = (data ?? {}) as Record<string, unknown>
  const extract = (key: string): SearchItem[] => {
    const raw = Array.isArray(obj[key]) ? (obj[key] as RawSearchItem[]) : []
    return raw.map(normalizeItem)
  }
  return {
    tracks: extract('tracks'),
    artists: extract('artists'),
    albums: extract('albums'),
    playlists: extract('playlists'),
  }
}
