import { useMusic, useForYou, getImageUrl } from '@/data/music'
import type { CuratedPlaylist } from '@/data/music'
import { ShelfSection } from './ShelfSection'
import type { ShelfCardItem } from './ShelfCard'
import { playOptionsFor } from './play'
import { FOR_YOU_MAX_ROWS } from './shelf-capacity'

/** The "For You" tab content — one shelf of curated playlists. The mock has
 *  no design for this tab's body (only its label, `media.jsx:120`), so this
 *  reuses the same card-grid visual language the "Quick Dials" shelves and
 *  search results already establish, rather than inventing a new one. */
export function ForYouShelf() {
  const { play } = useMusic()
  const { data: playlists } = useForYou()

  const items: ShelfCardItem[] = (playlists ?? []).map((playlist: CuratedPlaylist) => {
    const imageUrl = getImageUrl(playlist.image)
    return {
      key: playlist.uri,
      name: playlist.name,
      secondary: playlist.description,
      imageUrl,
      onTap: () =>
        play(
          playlist.uri,
          playOptionsFor({ uri: playlist.uri, mediaType: 'playlist', name: playlist.name, imageUrl }),
        ),
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
