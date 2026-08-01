import { Music } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMusic, useTopTracks, useRecentlyPlayed } from '@/data/music'
import type { RecentItem, TopTrack, EnqueueMode } from '@/data/music'
import { TrackActionsMenu } from './TrackActionsMenu'
import { encodeUriParam } from './track-url'

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

function DialItem({
  item,
  onTap,
  onPlayJustThis,
  onPlayNext,
  onAddToQueue,
  onGoToArtist,
  onGoToAlbum,
}: {
  item: RecentItem
  onTap: () => void
  onPlayJustThis: () => void
  onPlayNext: () => void
  onAddToQueue: () => void
  onGoToArtist: () => void
  onGoToAlbum: () => void
}) {
  const imgUrl = item.image_url ?? null
  return (
    <div className="relative flex flex-col items-center gap-2 p-3 rounded-lg bg-bg-card hover:bg-bg-primary text-center">
      <button
        onClick={onTap}
        className="flex flex-col items-center gap-2 active:scale-95 transition-transform w-full"
      >
        <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-bg-primary flex items-center justify-center">
          {imgUrl ? (
            <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <Music size={20} className="text-text-secondary" />
          )}
        </div>
        <span className="text-text-primary text-xs font-medium leading-tight line-clamp-2 w-full">
          {item.name}
        </span>
        <span className="text-text-secondary text-xs">{typeLabel(item.media_type)}</span>
      </button>
      <div className="absolute top-1 right-1">
        <TrackActionsMenu
          item={{
            uri: item.uri,
            media_type: item.media_type,
            name: item.name,
            artist: item.artist,
            artist_uri: item.artist_uri ?? null,
            album: item.album,
            album_uri: item.album_uri ?? null,
            image_url: item.image_url,
          }}
          onPlayRadio={onTap}
          onPlayJustThis={onPlayJustThis}
          onPlayNext={onPlayNext}
          onAddToQueue={onAddToQueue}
          onGoToArtist={onGoToArtist}
          onGoToAlbum={onGoToAlbum}
        />
      </div>
    </div>
  )
}

function TopTrackItem({
  track,
  onTap,
  onPlayJustThis,
  onPlayNext,
  onAddToQueue,
  onGoToArtist,
  onGoToAlbum,
}: {
  track: TopTrack
  onTap: () => void
  onPlayJustThis: () => void
  onPlayNext: () => void
  onAddToQueue: () => void
  onGoToArtist: () => void
  onGoToAlbum: () => void
}) {
  const imgUrl = track.image_url
  return (
    <div className="relative flex flex-col items-center gap-2 p-3 rounded-lg bg-bg-card hover:bg-bg-primary text-center">
      <button
        onClick={onTap}
        className="flex flex-col items-center gap-2 active:scale-95 transition-transform w-full"
      >
        <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-bg-primary flex items-center justify-center">
          {imgUrl ? (
            <img src={imgUrl} alt={track.name} className="w-full h-full object-cover" />
          ) : (
            <Music size={20} className="text-text-secondary" />
          )}
        </div>
        <span className="text-text-primary text-xs font-medium leading-tight line-clamp-2 w-full">
          {track.name}
        </span>
        <span className="text-text-secondary text-xs">{track.artist}</span>
      </button>
      <div className="absolute top-1 right-1">
        <TrackActionsMenu
          item={{
            uri: track.uri,
            media_type: 'track',
            name: track.name,
            artist: track.artist,
            artist_uri: track.artist_uri ?? null,
            album: track.album,
            album_uri: track.album_uri ?? null,
            image_url: track.image_url,
          }}
          onPlayRadio={onTap}
          onPlayJustThis={onPlayJustThis}
          onPlayNext={onPlayNext}
          onAddToQueue={onAddToQueue}
          onGoToArtist={onGoToArtist}
          onGoToAlbum={onGoToAlbum}
        />
      </div>
    </div>
  )
}

export function QuickDials() {
  const { play } = useMusic()
  const navigate = useNavigate()

  const { data: topTracks, isLoading: topLoading } = useTopTracks()
  const { data: recent, isLoading: recentLoading } = useRecentlyPlayed()

  const isLoading = topLoading && recentLoading

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <DialSkeleton key={i} />
        ))}
      </div>
    )
  }

  const hasTopTracks = topTracks && topTracks.length > 0
  const hasRecent = recent && recent.length > 0

  if (!hasTopTracks && !hasRecent) {
    return (
      <div className="flex items-center justify-center p-8 text-text-secondary text-sm">
        Play something to build your quick dials
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 overflow-auto">
      {hasTopTracks && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-text-secondary px-4 mb-2">
            Frequently Played
          </div>
          <div className="grid grid-cols-3 gap-3 px-4">
            {topTracks.map((track) => {
              const commonPlay = (mode: EnqueueMode, radio: boolean) =>
                play(track.uri, {
                  radio,
                  enqueueMode: mode,
                  mediaType: 'track',
                  name: track.name,
                  artist: track.artist,
                  artistUri: track.artist_uri ?? undefined,
                  album: track.album ?? undefined,
                  albumUri: track.album_uri ?? undefined,
                  imageUrl: track.image_url ?? undefined,
                })
              return (
                <TopTrackItem
                  key={track.uri}
                  track={track}
                  onTap={() => commonPlay('play', true)}
                  onPlayJustThis={() => commonPlay('play', false)}
                  onPlayNext={() => commonPlay('next', false)}
                  onAddToQueue={() => commonPlay('add', false)}
                  onGoToArtist={() =>
                    track.artist_uri && navigate(`/media/artist/${encodeUriParam(track.artist_uri)}`)
                  }
                  onGoToAlbum={() =>
                    track.album_uri && navigate(`/media/album/${encodeUriParam(track.album_uri)}`)
                  }
                />
              )
            })}
          </div>
        </div>
      )}

      {hasRecent && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-text-secondary px-4 mb-2">
            Recently Played
          </div>
          <div className="grid grid-cols-3 gap-3 px-4">
            {recent.map((item) => {
              const isTrack = item.media_type === 'track'
              const commonPlay = (mode: EnqueueMode, radio: boolean) =>
                play(item.uri, {
                  radio: radio && isTrack,
                  enqueueMode: mode,
                  mediaType: item.media_type,
                  name: item.name,
                  artist: item.artist,
                  artistUri: item.artist_uri ?? undefined,
                  album: item.album ?? undefined,
                  albumUri: item.album_uri ?? undefined,
                  imageUrl: item.image_url ?? undefined,
                })
              return (
                <DialItem
                  key={item.uri}
                  item={item}
                  onTap={() => commonPlay('play', true)}
                  onPlayJustThis={() => commonPlay('play', false)}
                  onPlayNext={() => commonPlay('next', false)}
                  onAddToQueue={() => commonPlay('add', false)}
                  onGoToArtist={() =>
                    item.artist_uri && navigate(`/media/artist/${encodeUriParam(item.artist_uri)}`)
                  }
                  onGoToAlbum={() =>
                    item.album_uri && navigate(`/media/album/${encodeUriParam(item.album_uri)}`)
                  }
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
