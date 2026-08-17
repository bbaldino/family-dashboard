import { useMusic, usePlaylists } from '@/integrations/music'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { Cover } from './Cover'
import { CARD_BG, CARD_RULE } from './colors'
import { MAX_PLAYLISTS } from './playlists-capacity'

/**
 * The Media page's Playlists shelf — the household's library playlists as a
 * 4-column grid of cover+name cards, filling the band the two Quick Dials
 * grids leave empty (mock `media.jsx:208-227`).
 *
 * A dedicated component rather than another `ShelfSection`: a playlist card is
 * only a cover and a name. It has no artist line, no track-actions menu, and
 * no track count — MA's library listing does not carry one (see the backend's
 * `get_playlists`) — so routing it through `ShelfCard`, which is built around a
 * secondary line and a per-track menu, would mean forcing an empty second row
 * and an unused menu slot. The mock draws playlists with their own markup too.
 *
 * Renders nothing when there are no playlists — the standing rule against an
 * empty heading over a blank grid.
 */
export function PlaylistsShelf() {
  const { play } = useMusic()
  const { data: playlists } = usePlaylists()

  const visible = (playlists ?? []).slice(0, MAX_PLAYLISTS)
  if (visible.length === 0) return null

  return (
    <div>
      <Kicker color="var(--ink-muted)">Playlists</Kicker>
      <div
        className="grid"
        style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 8 }}
      >
        {visible.map((playlist) => (
          <button
            key={playlist.uri}
            type="button"
            onClick={() =>
              play(playlist.uri, {
                mediaType: 'playlist',
                name: playlist.name,
                enqueueMode: 'play',
                radio: false,
                imageUrl: playlist.image_url ?? undefined,
              })
            }
            className="flex items-center text-left w-full min-w-0"
            style={{
              all: 'unset',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              padding: '8px 10px',
              background: CARD_BG,
              border: `1px solid ${CARD_RULE}`,
            }}
          >
            <Cover imageUrl={playlist.image_url} name={playlist.name} size={48} />
            <div
              className="truncate min-w-0 flex-1"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13.5,
                fontWeight: 600,
                lineHeight: 1.2,
                color: 'var(--ink)',
              }}
            >
              {playlist.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
