import { Music } from 'lucide-react'
import { useMusic, useForYou, getImageUrl } from '@/data/music'
import type { CuratedPlaylist } from '@/data/music'

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

  const { data, isLoading } = useForYou()

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
          onTap={() =>
            play(playlist.uri, {
              mediaType: 'playlist',
              name: playlist.name,
              imageUrl: getImageUrl(playlist.image) ?? undefined,
            })
          }
        />
      ))}
    </div>
  )
}
