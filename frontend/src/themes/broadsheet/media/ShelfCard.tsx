import { Cover } from './Cover'
import { CARD_BG, CARD_RULE } from './colors'

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
}

/** One card: a 48px `Cover`, then title over secondary, both ellipsised on
 *  one line — mock: `media.jsx:134-146`. A real `<button>`, not a styled
 *  `<div onClick>`, so every card is reachable and activatable the way a
 *  touchscreen kiosk (and a keyboard) both expect. */
export function ShelfCard({ item }: { item: ShelfCardItem }) {
  return (
    <button
      type="button"
      onClick={item.onTap}
      className="flex items-center text-left w-full min-w-0"
      style={{
        gap: 12,
        padding: '8px 10px',
        background: CARD_BG,
        border: `1px solid ${CARD_RULE}`,
        cursor: 'pointer',
      }}
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
  )
}
