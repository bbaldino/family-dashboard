import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Play } from 'lucide-react'
import { useAlbumDetail, useMusic } from '@/data/music'
import { decodeUriParam } from '@/themes/broadsheet/media/track-url'
import { MusicPageMasthead } from '@/themes/broadsheet/media/MusicPageMasthead'
import { RecordSleeve } from '@/themes/broadsheet/media/RecordSleeve'
import { RecordRunningOrder } from '@/themes/broadsheet/media/RecordRunningOrder'
import { MenuScrim } from '@/themes/broadsheet/media/MenuScrim'
import { buildTrackActionGroups } from '@/themes/broadsheet/media/build-track-action-groups'

/**
 * The Record — broadsheet's album view, registered at the shell's
 * `media.album` screen key (`ROUTE_PATHS['media.album']` = `media/album/:uri`,
 * owned by the shell and shared verbatim with grid's own `AlbumPage`; see
 * `shell/routes.ts`). Mock: `docs/superpowers/designs/broadsheet/music-pages.jsx:74-176`.
 *
 * The body uses the mock's own `position: absolute; top: 140; bottom: 64`
 * (mock `:134`) rather than the flex-column technique `Media.tsx`/`CentreSpread.tsx`
 * use for their own bodies: those two screens deviate because their
 * masthead's *height* isn't fixed (a room name, live weather). This
 * screen's masthead has none of that — a fixed-size kicker over a
 * single-line, clip-truncated title — so the mock's own measured offset is
 * trustworthy here in a way it wasn't there.
 *
 * Cold start / a bad URI: `useAlbumDetail` can resolve to `undefined` on
 * first paint or on a real fetch error, and this renders a written line
 * rather than a broken layout for either — the same requirement `CentreSpread.tsx`'s
 * own guard documents for its own hooks.
 */
export function Album() {
  const params = useParams<{ uri: string }>()
  const uri = params.uri ? decodeUriParam(params.uri) : ''
  const navigate = useNavigate()
  const { state, play } = useMusic()
  const { data, isLoading, error } = useAlbumDetail(uri)
  const [openMenuUri, setOpenMenuUri] = useState<string | null>(null)

  const currentTrackUri = state.activeQueue?.currentItem?.uri ?? null

  if (!data) {
    return (
      <div
        data-testid="broadsheet-album"
        className="broadsheet-root relative w-[1600px] h-[900px] flex items-center justify-center"
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 20,
            color: 'var(--ink-muted)',
          }}
        >
          {error ? "Couldn't load this record." : isLoading ? 'Loading the record…' : ''}
        </div>
      </div>
    )
  }

  const albumOptions = {
    mediaType: 'album',
    name: data.name,
    artist: data.artist ?? undefined,
    artistUri: data.artist_uri ?? undefined,
    imageUrl: data.image_url ?? undefined,
  }

  const closeMenu = () => setOpenMenuUri(null)

  return (
    <div data-testid="broadsheet-album" className="broadsheet-root relative w-[1600px] h-[900px]">
      <MusicPageMasthead
        kicker="The Record"
        title={data.name}
        titleFontSize={62}
        actionLabel="Play album"
        actionIcon={<Play size={12} />}
        onAction={() => play(uri, { ...albumOptions, radio: false })}
      />
      <div
        style={{
          position: 'absolute',
          top: 140,
          bottom: 64,
          left: 0,
          right: 0,
          display: 'grid',
          gridTemplateColumns: '330px 1fr',
        }}
      >
        <RecordSleeve
          album={data}
          onQueue={() => play(uri, { ...albumOptions, radio: false, enqueueMode: 'add' })}
          onRadio={() => play(uri, { ...albumOptions, radio: true })}
        />
        <RecordRunningOrder
          tracks={data.tracks}
          currentTrackUri={currentTrackUri}
          openMenuUri={openMenuUri}
          onToggleMenu={(trackUri) =>
            setOpenMenuUri((current) => (current === trackUri ? null : trackUri))
          }
          buildGroups={(track) =>
            buildTrackActionGroups({ track, play, navigate, onClose: closeMenu })
          }
        />
      </div>
      {openMenuUri && <MenuScrim onClose={closeMenu} />}
    </div>
  )
}
