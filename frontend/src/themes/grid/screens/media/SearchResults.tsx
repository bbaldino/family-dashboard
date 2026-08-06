import { useState } from 'react'
import { useNavigate, type NavigateFunction } from 'react-router-dom'
import { Music, Loader2 } from 'lucide-react'
import { useMusic, useSearch } from '@/integrations/music'
import type { EnqueueMode, SearchItem } from '@/integrations/music'
import { TrackActionsMenu } from './TrackActionsMenu'
import { encodeUriParam } from './track-url'

interface SearchResultsProps {
  /** What the user has typed right now — used to detect "still settling" state. */
  rawQuery: string
  /** Debounced query that's actually sent to the backend. */
  debouncedQuery: string
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
  playItem: (item: SearchItem, mode: EnqueueMode, radio: boolean) => Promise<void>
  navigate: NavigateFunction
  showArtist?: boolean
}

function ResultItem({
  item,
  pending,
  onTap,
  playItem,
  navigate,
  showArtist = false,
}: ResultItemProps) {
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
      <TrackActionsMenu
        item={{
          uri: item.uri,
          media_type: item.media_type,
          name: item.name,
          artist: item.artist,
          artist_uri: item.artist_uri ?? null,
          album: item.album ?? null,
          album_uri: item.album_uri ?? null,
          image_url: getDisplayImage(item.image),
        }}
        onPlayRadio={() => playItem(item, 'play', true)}
        onPlayJustThis={() => playItem(item, 'play', false)}
        onPlayNext={() => playItem(item, 'next', false)}
        onAddToQueue={() => playItem(item, 'add', false)}
        onGoToArtist={() =>
          item.artist_uri && navigate(`/media/artist/${encodeUriParam(item.artist_uri)}`)
        }
        onGoToAlbum={() =>
          item.album_uri && navigate(`/media/album/${encodeUriParam(item.album_uri)}`)
        }
      />
    </div>
  )
}

interface ResultGroupProps {
  heading: string
  items: SearchItem[]
  pendingUri: string | null
  onTap: (item: SearchItem) => void
  playItem: (item: SearchItem, mode: EnqueueMode, radio: boolean) => Promise<void>
  navigate: NavigateFunction
  showArtist?: boolean
}

function ResultGroup({
  heading,
  items,
  pendingUri,
  onTap,
  playItem,
  navigate,
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
          playItem={playItem}
          navigate={navigate}
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
  const navigate = useNavigate()
  const [pendingUri, setPendingUri] = useState<string | null>(null)

  // True while the debounce window is still open (user is still typing).
  const settling = rawQuery !== debouncedQuery

  const { data: results, isFetching } = useSearch(debouncedQuery)

  const playItem = async (item: SearchItem, mode: EnqueueMode, radio: boolean) => {
    setPendingUri(item.uri)
    try {
      await play(item.uri, {
        enqueueMode: mode,
        radio,
        mediaType: item.media_type,
        name: item.name,
        artist: item.artist,
        artistUri: item.artist_uri ?? undefined,
        album: item.album ?? undefined,
        albumUri: item.album_uri ?? undefined,
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
  const handleTap = (item: SearchItem) => playItem(item, 'play', item.media_type === 'track')

  // Settling or fetching the current debounced query → show the indicator
  // before any results are rendered, even if older results are still cached.
  const showFullPageLoading = (settling || isFetching) && !results
  if (showFullPageLoading) {
    return <StatusRow label={settling ? 'Searching…' : `Searching for "${debouncedQuery}"…`} />
  }

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
        playItem={playItem}
        navigate={navigate}
        showArtist
      />
      <ResultGroup
        heading="Artists"
        items={results.artists}
        pendingUri={pendingUri}
        onTap={(item) => handleTap(item)}
        playItem={playItem}
        navigate={navigate}
      />
      <ResultGroup
        heading="Albums"
        items={results.albums}
        pendingUri={pendingUri}
        onTap={(item) => handleTap(item)}
        playItem={playItem}
        navigate={navigate}
        showArtist
      />
      <ResultGroup
        heading="Playlists"
        items={results.playlists}
        pendingUri={pendingUri}
        onTap={(item) => handleTap(item)}
        playItem={playItem}
        navigate={navigate}
      />
    </div>
  )
}
