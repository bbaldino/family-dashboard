import { useQuery } from '@tanstack/react-query'
import { Music } from 'lucide-react'
import { musicIntegration } from '@/integrations/music/config'
import { useMusic } from '@/integrations/music/useMusic'
import type { RecentItem } from '@/integrations/music/types'
import { getImageUrl } from '@/integrations/music/utils'

function typeLabel(mediaType: string | undefined): string {
  switch (mediaType) {
    case 'playlist':
      return 'Playlist'
    case 'radio':
      return 'Radio'
    case 'album':
      return 'Album'
    case 'track':
      return 'Track'
    default:
      return mediaType ? mediaType.charAt(0).toUpperCase() + mediaType.slice(1) : ''
  }
}

function DialSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-bg-card animate-pulse">
      <div className="w-12 h-12 rounded bg-bg-primary" />
      <div className="w-16 h-3 rounded bg-bg-primary" />
      <div className="w-10 h-2 rounded bg-bg-primary" />
    </div>
  )
}

function DialItem({ item, onTap }: { item: RecentItem; onTap: () => void }) {
  const imgUrl = getImageUrl(item.image)
  return (
    <button
      onClick={onTap}
      className="flex flex-col items-center gap-2 p-3 rounded-lg bg-bg-card hover:bg-bg-primary active:scale-95 transition-transform text-center"
    >
      <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-bg-primary flex items-center justify-center">
        {imgUrl ? (
          <img
            src={imgUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Music size={20} className="text-text-secondary" />
        )}
      </div>
      <span className="text-text-primary text-xs font-medium leading-tight line-clamp-2 w-full">
        {item.name}
      </span>
      <span className="text-text-secondary text-xs">{typeLabel(item.media_type)}</span>
    </button>
  )
}

export function QuickDials() {
  const { play } = useMusic()

  const { data, isLoading } = useQuery({
    queryKey: ['music', 'recent'],
    queryFn: () => musicIntegration.api.get<RecentItem[]>('/recent'),
    refetchInterval: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <DialSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-text-secondary text-sm">
        Play something to build your quick dials
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {data.map((item) => (
        <DialItem
          key={item.uri}
          item={item}
          onTap={() => play(item.uri, item.media_type === 'track' ? true : undefined)}
        />
      ))}
    </div>
  )
}
