import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Music, Loader2, MoreVertical } from 'lucide-react'
import { musicIntegration } from '@/integrations/music/config'
import { useMusic } from '@/integrations/music/useMusic'
import type { EnqueueMode } from '@/integrations/music/MusicProvider'
import type { SearchItem } from '@/integrations/music/types'

interface SearchResultsType {
  tracks: SearchItem[]
  artists: SearchItem[]
  albums: SearchItem[]
  playlists: SearchItem[]
}

interface SearchResultsProps {
  /** What the user has typed right now — used to detect "still settling" state. */
  rawQuery: string
  /** Debounced query that's actually sent to the backend. */
  debouncedQuery: string
}

// Raw shape returned by the Music Assistant search endpoint
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

function parseSearchResponse(data: unknown): SearchResultsType {
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
  pending: boolean
  onTap: () => void
  onQueueAction: (mode: 'next' | 'add') => void
  /** Only tracks make sense to "play next" or "add to queue" — albums and
   *  playlists are containers, "queue next" semantics get murky. */
  showQueueActions: boolean
  showArtist?: boolean
}

function ResultItem({
  item,
  pending,
  onTap,
  onQueueAction,
  showQueueActions,
  showArtist = false,
}: ResultItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close the menu on outside click. Listen in the capture phase and stop
  // propagation so the underlying play button (or anything else) doesn't
  // also fire — clicking outside a popover should *only* dismiss it.
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return
      e.stopPropagation()
      e.preventDefault()
      setMenuOpen(false)
    }
    document.addEventListener('click', handler, { capture: true })
    return () => document.removeEventListener('click', handler, { capture: true })
  }, [menuOpen])

  return (
    <div
      className={`flex items-center gap-3 w-full px-3 py-2 rounded text-left ${
        pending ? 'opacity-60' : 'hover:bg-bg-primary'
      }`}
    >
      <button
        onClick={onTap}
        disabled={pending}
        className="flex-1 flex items-center gap-3 min-w-0 text-left transition-transform active:scale-95"
      >
        <div className="relative">
          <Thumbnail imageUrl={getDisplayImage(item.image)} name={item.name} />
          {pending && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
              <Loader2 size={16} className="text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-text-primary text-sm font-medium truncate">{item.name}</div>
          {showArtist && item.artist && (
            <div className="text-text-secondary text-xs truncate">{item.artist}</div>
          )}
        </div>
      </button>
      {showQueueActions && (
        <div ref={containerRef} className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            className="p-1.5 rounded text-text-secondary hover:bg-bg-primary hover:text-text-primary"
            aria-label="More play options"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 bg-bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[160px]">
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onQueueAction('next')
                }}
                className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-primary"
              >
                Play next
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onQueueAction('add')
                }}
                className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-primary"
              >
                Add to queue
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface ResultGroupProps {
  heading: string
  items: SearchItem[]
  pendingUri: string | null
  onTap: (item: SearchItem) => void
  onQueueAction: (item: SearchItem, mode: 'next' | 'add') => void
  showQueueActions: boolean
  showArtist?: boolean
}

function ResultGroup({
  heading,
  items,
  pendingUri,
  onTap,
  onQueueAction,
  showQueueActions,
  showArtist = false,
}: ResultGroupProps) {
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
          pending={pendingUri === item.uri}
          onTap={() => onTap(item)}
          onQueueAction={(mode) => onQueueAction(item, mode)}
          showQueueActions={showQueueActions}
          showArtist={showArtist}
        />
      ))}
    </section>
  )
}

function StatusRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-6 text-text-secondary text-sm">
      <Loader2 size={16} className="animate-spin" />
      <span>{label}</span>
    </div>
  )
}

export function SearchResults({ rawQuery, debouncedQuery }: SearchResultsProps) {
  const { play } = useMusic()
  const [pendingUri, setPendingUri] = useState<string | null>(null)

  // True while the debounce window is still open (user is still typing).
  const settling = rawQuery !== debouncedQuery

  const { data, isFetching } = useQuery({
    queryKey: ['music', 'search', debouncedQuery],
    queryFn: () =>
      musicIntegration.api.get<unknown>(`/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.length >= 2,
  })

  const playItem = async (
    item: SearchItem,
    mode: EnqueueMode,
    radio: boolean,
  ) => {
    setPendingUri(item.uri)
    try {
      await play(item.uri, {
        enqueueMode: mode,
        radio,
        mediaType: item.media_type,
        name: item.name,
        artist: item.artist,
        imageUrl: getDisplayImage(item.image) ?? undefined,
      })
    } finally {
      // Clear after a short window even if the call hung — keeps the UI honest.
      setTimeout(() => setPendingUri((prev) => (prev === item.uri ? null : prev)), 1200)
    }
  }
  // Default tap on a track: play it, then continue with a radio station seeded
  // from it ("...and keep going with similar music"). Albums / playlists /
  // artists already have built-in continuation, so no radio there.
  const handleTap = (item: SearchItem) =>
    playItem(item, 'play', item.media_type === 'track')
  // Explicit queue actions are literal — "Play next" means this exact track
  // next, not "start a radio after the current one ends".
  const handleQueueAction = (item: SearchItem, mode: 'next' | 'add') =>
    playItem(item, mode, false)

  // Settling or fetching the current debounced query → show the indicator
  // before any results are rendered, even if older results are still cached.
  const showFullPageLoading = (settling || isFetching) && !data
  if (showFullPageLoading) {
    return <StatusRow label={settling ? 'Searching…' : `Searching for "${debouncedQuery}"…`} />
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
        No results for &lsquo;{debouncedQuery}&rsquo;
      </div>
    )
  }

  return (
    <div className="py-2">
      {/* Subtle indicator when we have stale results showing while a new query is in flight */}
      {(settling || isFetching) && (
        <div className="flex items-center gap-2 px-3 pb-2 text-text-secondary text-xs">
          <Loader2 size={12} className="animate-spin" />
          <span>Updating…</span>
        </div>
      )}
      <ResultGroup
        heading="Tracks"
        items={results.tracks}
        pendingUri={pendingUri}
        onTap={(item) => handleTap(item)}
        onQueueAction={handleQueueAction}
        showQueueActions
        showArtist
      />
      <ResultGroup
        heading="Artists"
        items={results.artists}
        pendingUri={pendingUri}
        onTap={(item) => handleTap(item)}
        onQueueAction={handleQueueAction}
        showQueueActions={false}
      />
      <ResultGroup
        heading="Albums"
        items={results.albums}
        pendingUri={pendingUri}
        onTap={(item) => handleTap(item)}
        onQueueAction={handleQueueAction}
        showQueueActions={false}
        showArtist
      />
      <ResultGroup
        heading="Playlists"
        items={results.playlists}
        pendingUri={pendingUri}
        onTap={(item) => handleTap(item)}
        onQueueAction={handleQueueAction}
        showQueueActions={false}
      />
    </div>
  )
}
