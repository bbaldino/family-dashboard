import { ArrowLeft, Music, Radio } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMusic, useArtistDetail } from '@/data/music'
import type { EnqueueMode } from '@/data/music'
import { TrackActionsMenu } from './TrackActionsMenu'
import { decodeUriParam, encodeUriParam } from './track-url'

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function ArtistPage() {
  const params = useParams<{ uri: string }>()
  const uri = params.uri ? decodeUriParam(params.uri) : ''
  const navigate = useNavigate()
  const { play } = useMusic()
  const { data, isLoading, error } = useArtistDetail(uri)

  if (isLoading) {
    return <div className="p-4 text-text-secondary text-sm">Loading artist…</div>
  }
  if (error || !data) {
    return (
      <div className="p-4 text-text-secondary text-sm">
        Couldn&apos;t load artist.{' '}
        <button onClick={() => navigate(-1)} className="underline">
          Back
        </button>
      </div>
    )
  }

  const goToAlbum = (albumUri: string) => navigate(`/media/album/${encodeUriParam(albumUri)}`)

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
            className="w-16 h-16 rounded-full object-cover"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-bg-card flex items-center justify-center">
            <Music size={28} className="text-text-secondary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-text-primary text-lg font-semibold truncate">
            {data.name || 'Artist'}
          </div>
        </div>
        <button
          onClick={() => play(uri, { radio: true, mediaType: 'artist', name: data.name })}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black text-sm font-medium"
        >
          <Radio size={16} />
          Play radio
        </button>
      </div>

      {data.top_tracks.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
            Top tracks
          </div>
          <div className="flex flex-col">
            {data.top_tracks.map((t) => {
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
                  <button
                    onClick={() => commonPlay('play', true)}
                    className="flex-1 flex items-center gap-3 min-w-0 text-left"
                  >
                    {t.image_url ? (
                      <img
                        src={t.image_url}
                        alt={t.name}
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-bg-card flex items-center justify-center">
                        <Music size={16} className="text-text-secondary" />
                      </div>
                    )}
                    <div className="text-text-primary text-sm truncate">{t.name}</div>
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
                    onGoToAlbum={() => t.album_uri && goToAlbum(t.album_uri)}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {data.albums.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-2">
            Albums
          </div>
          <div className="grid grid-cols-3 gap-3">
            {data.albums.map((a) => (
              <button
                key={a.uri}
                onClick={() => goToAlbum(a.uri)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-bg-card hover:bg-bg-primary active:scale-95 transition-transform text-center"
              >
                <div className="w-24 h-24 rounded overflow-hidden bg-bg-primary flex items-center justify-center">
                  {a.image_url ? (
                    <img src={a.image_url} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <Music size={28} className="text-text-secondary" />
                  )}
                </div>
                <span className="text-text-primary text-xs font-medium leading-tight line-clamp-2 w-full">
                  {a.name}
                </span>
                {a.year && <span className="text-text-secondary text-xs">{a.year}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
