import { useNavigate } from 'react-router-dom'
import { useMusic, useSearch, getImageUrl } from '@/data/music'
import type { SearchItem } from '@/data/music'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { ShelfGrid } from './ShelfGrid'
import type { ShelfCardItem } from './ShelfCard'
import { playOptionsFor } from './play'
import { buildShelfActionGroups } from './build-shelf-action-groups'
import { typeLabel } from './labels'
import { SEARCH_RESULTS_MAX_ROWS } from './shelf-capacity'

/** Takes over the shelf column while a search query is active
 * (`Media.tsx` decides when — two-plus characters, debounced). The mock's
 * static search box (`media.jsx:109-117`) has no results state to follow,
 * so this reuses the same card-grid language the shelves already
 * establish: one flat, capped grid across all four `SearchResults` buckets
 * (tracks first, then albums, artists, playlists), rather than inventing
 * four separate titled sections the mock never showed either.
 *
 * A result can be a track, album, artist, or playlist (`SearchItem.media_type`
 * — the same distinction grid's own `SearchResults.tsx` makes, read for
 * reference only, nothing imported: broadsheet may not import from grid).
 * Each card's menu is built per-item by `build-shelf-action-groups.ts`,
 * which is what keeps "Go to album" off an album's own row and drops the
 * whole "Go to" group for an artist or playlist result — see that module's
 * header comment for the full rule. */
export function SearchResultsPanel({
  query,
  openMenuUri,
  onToggleMenu,
  onCloseMenu,
}: {
  query: string
  openMenuUri: string | null
  onToggleMenu: (uri: string) => void
  onCloseMenu: () => void
}) {
  const { play } = useMusic()
  const navigate = useNavigate()
  const { data: results, isFetching } = useSearch(query)

  const flattened: SearchItem[] = results
    ? [...results.tracks, ...results.albums, ...results.artists, ...results.playlists]
    : []

  const items: ShelfCardItem[] = flattened.map((item) => {
    const imageUrl = getImageUrl(item.image)
    const playable = {
      uri: item.uri,
      mediaType: item.media_type,
      name: item.name,
      artist: item.artist,
      artistUri: item.artist_uri,
      album: item.album,
      albumUri: item.album_uri,
      imageUrl,
    }
    return {
      key: item.uri,
      name: item.name,
      secondary: item.artist ?? typeLabel(item.media_type),
      imageUrl,
      onTap: () => play(item.uri, playOptionsFor(playable)),
      menu: {
        isOpen: openMenuUri === item.uri,
        onToggle: () => onToggleMenu(item.uri),
        kicker: typeLabel(item.media_type),
        title: item.name,
        groups: buildShelfActionGroups({ item: playable, play, navigate, onClose: onCloseMenu }),
      },
    }
  })

  if (!results && isFetching) {
    return (
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--ink-muted)',
          letterSpacing: '0.1em',
        }}
      >
        Searching…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontStyle: 'italic',
          fontSize: 15,
          color: 'var(--ink-muted)',
        }}
      >
        No results for &ldquo;{query}&rdquo;.
      </div>
    )
  }

  return (
    <div>
      <Kicker>Results</Kicker>
      <div style={{ marginTop: 8 }}>
        <ShelfGrid items={items} maxRows={SEARCH_RESULTS_MAX_ROWS} />
      </div>
    </div>
  )
}
