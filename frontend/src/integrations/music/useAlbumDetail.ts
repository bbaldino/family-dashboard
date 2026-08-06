import { useQuery } from '@tanstack/react-query'
import { activeScenario } from '@/lib/scenario'
import { musicIntegration } from './config'
import { musicAlbumDetailFixtureFor } from './fixtures'
import type { ArtistTrack } from './useArtistDetail'

export interface AlbumDetail {
  name: string
  artist: string | null
  artist_uri: string | null
  image_url: string | null
  year: number | null
  /** From MA's `metadata.label`. Absent for providers/items MA hasn't
   *  populated a label for. */
  label: string | null
  /** From MA's `metadata.description`. Null today for most albums — MA only
   *  enriches metadata for library items. Falls back to nothing in the UI
   *  when absent. */
  description: string | null
  tracks: ArtistTrack[]
}

export function useAlbumDetail(uri: string) {
  return useQuery({
    queryKey: ['music', 'album', uri],
    queryFn: () => {
      const fixture = musicAlbumDetailFixtureFor(activeScenario, uri)
      return fixture
        ? Promise.resolve(fixture)
        : musicIntegration.api.get<AlbumDetail>(`/album?uri=${encodeURIComponent(uri)}`)
    },
    staleTime: 10 * 60 * 1000,
    enabled: uri.length > 0,
  })
}
