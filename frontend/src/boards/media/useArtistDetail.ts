import { useQuery } from '@tanstack/react-query'
import { musicIntegration } from '@/integrations/music/config'

export interface ArtistTrack {
  uri: string
  name: string
  artist: string | null
  artist_uri: string | null
  album: string | null
  album_uri: string | null
  image_url: string | null
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
  top_tracks: ArtistTrack[]
  albums: ArtistAlbumSummary[]
}

export function useArtistDetail(uri: string) {
  return useQuery({
    queryKey: ['music', 'artist', uri],
    queryFn: () =>
      musicIntegration.api.get<ArtistDetail>(`/artist?uri=${encodeURIComponent(uri)}`),
    staleTime: 10 * 60 * 1000,
    enabled: uri.length > 0,
  })
}
