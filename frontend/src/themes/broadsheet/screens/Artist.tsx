import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useArtistDetail, useMusic } from '@/integrations/music'
import { decodeUriParam, encodeUriParam } from '@/themes/broadsheet/media/track-url'
import { MusicPageMasthead } from '@/themes/broadsheet/media/MusicPageMasthead'
import { ProfileStandfirst } from '@/themes/broadsheet/media/ProfileStandfirst'
import { ProfileTopTracks } from '@/themes/broadsheet/media/ProfileTopTracks'
import { ProfileDiscography } from '@/themes/broadsheet/media/ProfileDiscography'
import { MenuScrim } from '@/themes/broadsheet/media/MenuScrim'
import { buildTrackActionGroups } from '@/themes/broadsheet/media/build-track-action-groups'
import { buildArtistStandfirst } from '@/themes/broadsheet/media/artist-standfirst'

/**
 * The Profile — broadsheet's artist view, registered at the shell's
 * `media.artist` screen key (`ROUTE_PATHS['media.artist']`, shared verbatim
 * with grid's own `ArtistPage`; see `shell/routes.ts`). Mock:
 * `docs/superpowers/designs/broadsheet/music-pages.jsx:181-275`.
 *
 * Body offset (`top: 190`) and cold-start/error handling both follow
 * `Album.tsx`'s own reasoning — see that file's header comment for why the
 * mock's own measured numbers are trusted here, unlike `Media.tsx`/`CentreSpread.tsx`.
 */
export function Artist() {
  const params = useParams<{ uri: string }>()
  const uri = params.uri ? decodeUriParam(params.uri) : ''
  const navigate = useNavigate()
  const { state, play } = useMusic()
  const { data, isLoading, error } = useArtistDetail(uri)
  const [openMenuUri, setOpenMenuUri] = useState<string | null>(null)

  const currentTrackUri = state.activeQueue?.currentItem?.uri ?? null

  if (!data) {
    return (
      <div
        data-testid="broadsheet-artist"
        className="broadsheet-root relative w-[1600px] h-full flex items-center justify-center"
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontStyle: 'italic',
            fontSize: 20,
            color: 'var(--ink-muted)',
          }}
        >
          {error ? "Couldn't load this artist." : isLoading ? 'Loading the profile…' : ''}
        </div>
      </div>
    )
  }

  const closeMenu = () => setOpenMenuUri(null)
  const standfirst =
    data.description ??
    buildArtistStandfirst({ genres: data.genres, albumCount: data.albums.length })

  return (
    <div data-testid="broadsheet-artist" className="broadsheet-root relative w-[1600px] h-full">
      <MusicPageMasthead
        kicker="The Profile"
        title={data.name}
        titleFontSize={58}
        actionLabel="Play radio"
        actionIcon={<Radio size={12} />}
        onAction={() =>
          play(uri, {
            radio: true,
            mediaType: 'artist',
            name: data.name,
            imageUrl: data.image_url ?? undefined,
          })
        }
      />
      <ProfileStandfirst text={standfirst} />
      <div
        style={{
          position: 'absolute',
          top: 190,
          bottom: 64,
          left: 0,
          right: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 400px',
        }}
      >
        <ProfileTopTracks
          tracks={data.top_tracks}
          currentTrackUri={currentTrackUri}
          openMenuUri={openMenuUri}
          onToggleMenu={(trackUri) =>
            setOpenMenuUri((current) => (current === trackUri ? null : trackUri))
          }
          buildGroups={(track) =>
            buildTrackActionGroups({ track, play, navigate, onClose: closeMenu })
          }
        />
        <ProfileDiscography
          albums={data.albums}
          onOpenAlbum={(albumUri) => navigate(`/media/album/${encodeUriParam(albumUri)}`)}
        />
      </div>
      {openMenuUri && <MenuScrim onClose={closeMenu} />}
    </div>
  )
}
