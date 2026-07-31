import { ArrowLeft, Music, Play } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMusic } from '@/data/music'
import type { EnqueueMode } from '@/data/music'
import { TrackActionsMenu } from './TrackActionsMenu'
import { decodeUriParam, encodeUriParam } from './track-url'
import { useAlbumDetail } from './useAlbumDetail'

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function AlbumPage() {
  const params = useParams<{ uri: string }>()
  const uri = params.uri ? decodeUriParam(params.uri) : ''
  const navigate = useNavigate()
  const { play } = useMusic()
  const { data, isLoading, error } = useAlbumDetail(uri)

  if (isLoading) {
    return <div className="p-4 text-text-secondary text-sm">Loading album…</div>
  }
  if (error || !data) {
    return (
      <div className="p-4 text-text-secondary text-sm">
        Couldn&apos;t load album.{' '}
        <button onClick={() => navigate(-1)} className="underline">
          Back
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 flex flex-col gap-6 overflow-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded hover:bg-bg-card"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        {data.image_url ? (
          <img
            src={data.image_url}
            alt={data.name}
            className="w-20 h-20 rounded object-cover"
          />
        ) : (
          <div className="w-20 h-20 rounded bg-bg-card flex items-center justify-center">
            <Music size={28} className="text-text-secondary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-text-primary text-lg font-semibold truncate">
            {data.name || 'Album'}
          </div>
          {data.artist && (
            <button
              onClick={() =>
                data.artist_uri &&
                navigate(`/media/artist/${encodeUriParam(data.artist_uri)}`)
              }
              className="text-text-secondary text-sm truncate hover:underline text-left"
              disabled={!data.artist_uri}
            >
              {data.artist}
            </button>
          )}
          {(data.year || data.tracks.length > 0) && (
            <div className="text-text-secondary text-xs mt-0.5">
              {[
                data.year || null,
                data.tracks.length ? `${data.tracks.length} tracks` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
        </div>
        <button
          onClick={() =>
            play(uri, {
              radio: false,
              mediaType: 'album',
              name: data.name,
              artist: data.artist ?? undefined,
              artistUri: data.artist_uri ?? undefined,
              imageUrl: data.image_url ?? undefined,
            })
          }
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm font-medium"
        >
          <Play size={16} />
          Play album
        </button>
      </div>

      <div className="flex flex-col">
        {data.tracks.map((t, i) => {
          const commonPlay = (mode: EnqueueMode, radio: boolean) =>
            play(t.uri, {
              radio,
              enqueueMode: mode,
              mediaType: 'track',
              name: t.name,
              artist: t.artist ?? undefined,
              artistUri: t.artist_uri ?? undefined,
              album: t.album ?? undefined,
              albumUri: t.album_uri ?? undefined,
              imageUrl: t.image_url ?? undefined,
            })
          return (
            <div
              key={t.uri}
              className="flex items-center gap-3 px-2 py-2 rounded hover:bg-bg-primary"
            >
              <span className="text-text-secondary text-xs w-6 text-right">
                {i + 1}
              </span>
              <button
                onClick={() => commonPlay('play', true)}
                className="flex-1 min-w-0 text-left text-sm text-text-primary truncate"
              >
                {t.name}
              </button>
              {t.duration != null && (
                <span className="text-text-secondary text-xs tabular-nums">
                  {formatDuration(t.duration)}
                </span>
              )}
              <TrackActionsMenu
                item={{
                  uri: t.uri,
                  media_type: 'track',
                  name: t.name,
                  artist: t.artist ?? undefined,
                  artist_uri: t.artist_uri,
                  album: t.album,
                  album_uri: t.album_uri,
                  image_url: t.image_url,
                }}
                onPlayRadio={() => commonPlay('play', true)}
                onPlayJustThis={() => commonPlay('play', false)}
                onPlayNext={() => commonPlay('next', false)}
                onAddToQueue={() => commonPlay('add', false)}
                onGoToArtist={() =>
                  t.artist_uri && navigate(`/media/artist/${encodeUriParam(t.artist_uri)}`)
                }
                onGoToAlbum={() =>
                  t.album_uri && navigate(`/media/album/${encodeUriParam(t.album_uri)}`)
                }
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
