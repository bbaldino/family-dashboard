import { useQuery } from '@tanstack/react-query'
import { Music } from 'lucide-react'
import { musicIntegration } from '@/integrations/music/config'
import { useMusic } from '@/integrations/music/useMusic'
import { getImageUrl } from '@/integrations/music/utils'

interface CuratedPlaylist {
  name: string
  description: string
  uri: string
  image?: { path: string } | string | null
}

// Well-known Spotify playlist IDs that are stable per-account
const CURATED_PLAYLISTS = [
  { name: 'Discover Weekly', query: 'Discover Weekly' },
  { name: 'Release Radar', query: 'Release Radar' },
  { name: 'Daily Mix 1', query: 'Daily Mix 1' },
  { name: 'Daily Mix 2', query: 'Daily Mix 2' },
  { name: 'Daily Mix 3', query: 'Daily Mix 3' },
  { name: 'Daily Mix 4', query: 'Daily Mix 4' },
]

async function fetchCuratedPlaylists(): Promise<CuratedPlaylist[]> {
  const results: CuratedPlaylist[] = []

  for (const { name, query } of CURATED_PLAYLISTS) {
    try {
      const data = await musicIntegration.api.get<any>(
        `/search?q=${encodeURIComponent(query)}`,
      )
      const playlists = data?.playlists as any[] | undefined
      if (playlists && playlists.length > 0) {
        // Find the best match — exact name match preferred
        const match =
          playlists.find(
            (p: any) => p.name?.toLowerCase() === name.toLowerCase(),
          ) ?? playlists[0]
        const imgPath =
          match.metadata?.images?.[0]?.path ??
          (typeof match.image === 'object' ? match.image?.path : match.image)
        results.push({
          name: match.name ?? name,
          description: name,
          uri: match.uri,
          image: imgPath ? { path: imgPath } : null,
        })
      }
    } catch {
      // Skip failed searches
    }
  }

  return results
}

function PlaylistCard({
  playlist,
  onTap,
}: {
  playlist: CuratedPlaylist
  onTap: () => void
}) {
  const imgUrl = getImageUrl(playlist.image)
  return (
    <button
      onClick={onTap}
      className="flex items-center gap-4 p-3 rounded-lg bg-bg-card hover:bg-bg-primary active:scale-[0.98] transition-transform text-left w-full"
    >
      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-bg-primary flex items-center justify-center">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={playlist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Music size={24} className="text-text-secondary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-text-primary text-sm font-medium truncate">
          {playlist.name}
        </div>
        <div className="text-text-secondary text-xs truncate">
          {playlist.description}
        </div>
      </div>
    </button>
  )
}

export function ForYou() {
  const { play } = useMusic()

  const { data, isLoading } = useQuery({
    queryKey: ['music', 'for-you'],
    queryFn: fetchCuratedPlaylists,
    refetchInterval: 30 * 60 * 1000, // refresh every 30 min
    staleTime: 10 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-3 rounded-lg bg-bg-card animate-pulse"
          >
            <div className="w-16 h-16 rounded-lg bg-bg-primary" />
            <div className="flex-1">
              <div className="w-32 h-4 rounded bg-bg-primary mb-2" />
              <div className="w-20 h-3 rounded bg-bg-primary" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-text-secondary text-sm">
        No personalized playlists found
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {data.map((playlist) => (
        <PlaylistCard
          key={playlist.uri}
          playlist={playlist}
          onTap={() => play(playlist.uri)}
        />
      ))}
    </div>
  )
}
