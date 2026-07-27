import { useQuery } from '@tanstack/react-query'
import { musicIntegration } from '@/integrations/music/config'
import type { ArtistTrack } from './useArtistDetail'

export interface AlbumDetail {
  name: string
  artist: string | null
  artist_uri: string | null
  image_url: string | null
  year: number | null
  tracks: ArtistTrack[]
}

export function useAlbumDetail(uri: string) {
  return useQuery({
    queryKey: ['music', 'album', uri],
    queryFn: () =>
      musicIntegration.api.get<AlbumDetail>(`/album?uri=${encodeURIComponent(uri)}`),
    staleTime: 10 * 60 * 1000,
    enabled: uri.length > 0,
  })
}
