import { useQuery } from '@tanstack/react-query'
import { Music } from 'lucide-react'
import { musicIntegration } from '@/integrations/music/config'
import { useMusic } from '@/integrations/music/useMusic'
import type { SearchItem } from '@/integrations/music/types'

interface SearchResultsType {
  tracks: SearchItem[]
  artists: SearchItem[]
  albums: SearchItem[]
  playlists: SearchItem[]
}
import { LoadingSpinner } from '@/ui/LoadingSpinner'

interface SearchResultsProps {
  query: string
}

// Raw shape returned by the Music Assistant search endpoint
interface RawSearchItem {
  name?: string
  uri?: string
  image?: { path?: string } | null
  metadata?: { images?: Array<{ path?: string }> }
  media_type?: string
  artists?: Array<{ name?: string }>
}

function getItemImage(raw: RawSearchItem): string | null {
  // Try top-level image first, then metadata.images[0]
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
  }
}

function parseSearchResponse(data: any): SearchResultsType {
  // MA returns an object with keys like "tracks", "artists", "albums", "playlists"
  // Each value is an array of raw items
  const extract = (key: string): SearchItem[] => {
    const raw: RawSearchItem[] = Array.isArray(data?.[key]) ? data[key] : []
    return raw.map(normalizeItem)
  }

  return {
    tracks: extract('tracks'),
    artists: extract('artists'),
    albums: extract('albums'),
    playlists: extract('playlists'),
  }
}

function Thumbnail({ imageUrl, name }: { imageUrl: string | null; name: string }) {
  return (
    <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-bg-primary flex items-center justify-center">
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        <Music size={16} className="text-text-secondary" />
      )}
    </div>
  )
}

function getDisplayImage(image: SearchItem['image']): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (typeof image === 'object' && 'path' in image) return image.path
  return null
}

interface ResultItemProps {
  item: SearchItem
  onTap: () => void
  showArtist?: boolean
}

function ResultItem({ item, onTap, showArtist = false }: ResultItemProps) {
  return (
    <button
      onClick={onTap}
      className="flex items-center gap-3 w-full px-3 py-2 rounded hover:bg-bg-primary active:scale-95 transition-transform text-left"
    >
      <Thumbnail imageUrl={getDisplayImage(item.image)} name={item.name} />
      <div className="flex-1 min-w-0">
        <div className="text-text-primary text-sm font-medium truncate">{item.name}</div>
        {showArtist && item.artist && (
          <div className="text-text-secondary text-xs truncate">{item.artist}</div>
        )}
      </div>
    </button>
  )
}

interface ResultGroupProps {
  heading: string
  items: SearchItem[]
  onTap: (item: SearchItem) => void
  showArtist?: boolean
}

function ResultGroup({ heading, items, onTap, showArtist = false }: ResultGroupProps) {
  if (items.length === 0) return null

  return (
    <section className="mb-4">
      <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wide px-3 pb-1">
        {heading}
      </h3>
      {items.slice(0, 5).map((item) => (
        <ResultItem
          key={item.uri}
          item={item}
          onTap={() => onTap(item)}
          showArtist={showArtist}
        />
      ))}
    </section>
  )
}

export function SearchResults({ query }: SearchResultsProps) {
  const { play } = useMusic()

  const { data, isLoading } = useQuery({
    queryKey: ['music', 'search', query],
    queryFn: () => musicIntegration.api.get<any>(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  })

  if (isLoading) {
    return <LoadingSpinner />
  }

  const results = data ? parseSearchResponse(data) : null
  const hasResults =
    results &&
    (results.tracks.length > 0 ||
      results.artists.length > 0 ||
      results.albums.length > 0 ||
      results.playlists.length > 0)

  if (!hasResults) {
    return (
      <div className="flex items-center justify-center p-8 text-text-secondary text-sm">
        No results for &lsquo;{query}&rsquo;
      </div>
    )
  }

  return (
    <div className="py-2">
      <ResultGroup
        heading="Tracks"
        items={results.tracks}
        onTap={(item) => play(item.uri, true)}
        showArtist
      />
      <ResultGroup
        heading="Artists"
        items={results.artists}
        onTap={(item) => play(item.uri)}
      />
      <ResultGroup
        heading="Albums"
        items={results.albums}
        onTap={(item) => play(item.uri)}
        showArtist
      />
      <ResultGroup
        heading="Playlists"
        items={results.playlists}
        onTap={(item) => play(item.uri)}
      />
    </div>
  )
}
