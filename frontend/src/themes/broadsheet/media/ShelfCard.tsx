import { Cover } from './Cover'
import { TrackActionsTrigger } from './TrackActionsTrigger'
import type { TrackActionsMenuGroup } from './TrackActionsMenu'
import { CARD_BG, CARD_RULE } from './colors'

/** A card's track-actions-menu wiring — present whenever the card's own
 *  item can be routed through the shared menu (see `build-shelf-action-groups.ts`
 *  for which actions that ends up being, per media type). `ShelfCard`
 *  itself doesn't decide any of this; it only renders whatever its caller
 *  built, the same division of labour `AlbumTrackRow`/`ArtistTrackRow`
 *  already draw with their own `groups` prop. */
export interface ShelfCardMenu {
  isOpen: boolean
  onToggle: () => void
  kicker: string
  title: string
  groups: TrackActionsMenuGroup[]
}

/** One card's worth of display data for the shelf/for-you/search grids —
 *  `QuickDialsShelves`, `ForYouShelf`, and `SearchResultsPanel` each map
 *  their own source type down to this before rendering. */
export interface ShelfCardItem {
  /** React key and the tap target's identity — the item's `uri`. */
  key: string
  name: string
  /** The line under the title — an artist for a track/album, or a written
   *  media-type label (`labels.ts`) when there's no artist to show. */
  secondary: string
  imageUrl: string | null
  onTap: () => void
  /** Omitted only when a caller has nothing to route through the shared
   *  menu — doesn't happen for any of today's three callers, since every
   *  item can at least be enqueued next or added to the queue, but kept
   *  optional rather than assumed. */
  menu?: ShelfCardMenu
}

/** One card: a 48px `Cover`, then title over secondary, both ellipsised on
 *  one line — mock: `media.jsx:134-146`, plus (new) a trailing `⋮` trigger
 *  for the shared track-actions menu when the card has one.
 *
 * The card can no longer be one big `<button>` once it has a second,
 * independent tap target: a `<button>` nested inside a `<button>` is
 * invalid HTML (and unreliable — browsers vary on which one actually
 * receives the click). So this is a plain `<div>` wrapping two real
 * `<button>`s side by side — the cover+text button still does the whole
 * card's original job (reachable, activatable, `flex-1` so it still claims
 * all the space the trigger doesn't need), and the trigger is its own
 * small fixed-width slot at the trailing edge, matching where every other
 * row with this menu already puts it (`AlbumTrackRow`/`ArtistTrackRow`'s
 * own trailing column) rather than inventing a new placement rule for a
 * grid instead of a list. A card is tight (48px cover, two single-line
 * ellipsised rows) but the trigger is a single mono glyph — a few px plus a
 * gap — so it costs the text almost nothing beyond what it can already
 * lose to its own `truncate`.
 *
 * `position: relative` only while the menu is open, on the card's own root
 * — not just the trigger's cell — is deliberate: `TrackActionsMenu` anchors
 * `right: 0` against its nearest positioned ancestor, and this card is
 * already guaranteed to sit fully inside the 1600px canvas (it's one cell
 * of `ShelfGrid`'s own 4-column layout), so anchoring the menu to the
 * card's own right edge — not the viewport's — means it can never overflow
 * past x=1600 from any column, including the rightmost. Same technique
 * `AlbumTrackRow.tsx` already uses for its own row.
 */
export function ShelfCard({ item }: { item: ShelfCardItem }) {
  const isMenuOpen = item.menu?.isOpen ?? false

  return (
    <div
      className="flex items-center w-full min-w-0"
      style={{
        gap: 8,
        padding: '8px 10px',
        background: CARD_BG,
        border: `1px solid ${CARD_RULE}`,
        position: isMenuOpen ? 'relative' : 'static',
        zIndex: isMenuOpen ? 30 : 'auto',
      }}
    >
      <button
        type="button"
        onClick={item.onTap}
        className="flex items-center text-left min-w-0 flex-1"
        style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1, cursor: 'pointer' }}
      >
        <Cover imageUrl={item.imageUrl} name={item.name} size={48} />
        <div className="min-w-0 flex-1">
          <div
            className="truncate"
            style={{ fontFamily: 'var(--font-display)', fontSize: 13.5, fontWeight: 600, lineHeight: 1.2, color: 'var(--ink)' }}
          >
            {item.name}
          </div>
          <div
            className="truncate"
            style={{
              fontFamily: 'var(--font-display)',
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--ink-muted)',
              marginTop: 1,
            }}
          >
            {item.secondary}
          </div>
        </div>
      </button>
      {item.menu && (
        <TrackActionsTrigger
          isOpen={item.menu.isOpen}
          onToggle={item.menu.onToggle}
          kicker={item.menu.kicker}
          title={item.menu.title}
          groups={item.menu.groups}
        />
      )}
    </div>
  )
}
