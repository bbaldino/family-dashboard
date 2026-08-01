import { useQuery } from '@tanstack/react-query'
import { activeScenario } from '@/data/scenario'
import { musicIntegration } from './config'
import { musicArtistDetailFixtureFor } from './fixtures'

/** One entry in a track's full artist credit list, from the backend's `artists[]`. */
export interface TrackArtist {
  name: string
  uri: string | null
}

export interface ArtistTrack {
  uri: string
  name: string
  artist: string | null
  artist_uri: string | null
  /** Full artist credit list, in MA's order. `artist`/`artist_uri` above
   *  duplicate `artists[0]`; "featured" artists are `artists` beyond the first. */
  artists: TrackArtist[]
  album: string | null
  album_uri: string | null
  image_url: string | null
  duration: number | null
}

export interface ArtistAlbumSummary {
  uri: string
  name: string
  image_url: string | null
  year: number | null
}

export interface ArtistDetail {
  name: string
  image_url: string | null
  /** From MA's `metadata.genres`. Empty when MA hasn't populated genres for
   *  this artist/provider. */
  genres: string[]
  /** From MA's `metadata.description`. Null today for most artists — MA only
   *  enriches metadata for library items. Falls back to nothing in the UI
   *  when absent. */
  description: string | null
  top_tracks: ArtistTrack[]
  albums: ArtistAlbumSummary[]
}

export function useArtistDetail(uri: string) {
  return useQuery({
    queryKey: ['music', 'artist', uri],
    queryFn: () => {
      const fixture = musicArtistDetailFixtureFor(activeScenario, uri)
      return fixture
        ? Promise.resolve(fixture)
        : musicIntegration.api.get<ArtistDetail>(`/artist?uri=${encodeURIComponent(uri)}`)
    },
    staleTime: 10 * 60 * 1000,
    enabled: uri.length > 0,
  })
}
