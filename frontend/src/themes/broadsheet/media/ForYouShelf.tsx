import { useNavigate } from 'react-router-dom'
import { useMusic, useForYou, getImageUrl } from '@/data/music'
import type { CuratedPlaylist } from '@/data/music'
import { ShelfSection } from './ShelfSection'
import type { ShelfCardItem } from './ShelfCard'
import { playOptionsFor } from './play'
import { buildShelfActionGroups } from './build-shelf-action-groups'
import { typeLabel } from './labels'
import { FOR_YOU_MAX_ROWS } from './shelf-capacity'

/** The "For You" tab content — one shelf of curated playlists. The mock has
 *  no design for this tab's body (only its label, `media.jsx:120`), so this
 *  reuses the same card-grid visual language the "Quick Dials" shelves and
 *  search results already establish, rather than inventing a new one.
 *
 * A playlist never gets "Play just this X" (redundant with the card's own
 * tap) or a "Go to" group (a playlist has no artist/album of its own) — see
 * `build-shelf-action-groups.ts`'s header comment — so its menu is always
 * exactly "Play radio from this" / "Play next" / "Add to queue". Still a
 * real, useful menu: none of those three are reachable by tapping the card. */
export function ForYouShelf({
  openMenuUri,
  onToggleMenu,
  onCloseMenu,
}: {
  openMenuUri: string | null
  onToggleMenu: (uri: string) => void
  onCloseMenu: () => void
}) {
  const { play } = useMusic()
  const navigate = useNavigate()
  const { data: playlists } = useForYou()

  const items: ShelfCardItem[] = (playlists ?? []).map((playlist: CuratedPlaylist) => {
    const imageUrl = getImageUrl(playlist.image)
    const playable = { uri: playlist.uri, mediaType: 'playlist', name: playlist.name, imageUrl }
    return {
      key: playlist.uri,
      name: playlist.name,
      secondary: playlist.description,
      imageUrl,
      onTap: () => play(playlist.uri, playOptionsFor(playable)),
      menu: {
        isOpen: openMenuUri === playlist.uri,
        onToggle: () => onToggleMenu(playlist.uri),
        kicker: typeLabel('playlist'),
        title: playlist.name,
        groups: buildShelfActionGroups({ item: playable, play, navigate, onClose: onCloseMenu }),
      },
    }
  })

  if (items.length === 0) {
    return (
      <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-muted)' }}>
        No curated playlists yet.
      </div>
    )
  }

  return <ShelfSection title="For you" items={items} maxRows={FOR_YOU_MAX_ROWS} />
}
