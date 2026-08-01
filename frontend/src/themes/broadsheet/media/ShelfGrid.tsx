import { ShelfCard, type ShelfCardItem } from './ShelfCard'

/** A 4-column grid of `ShelfCard`s, capped to `maxRows` rows — the rest are
 *  silently dropped rather than pushing the section (or its sibling) off
 *  the fixed canvas. See `shelf-capacity.ts` for how `maxRows` values are
 *  chosen. */
export function ShelfGrid({ items, maxRows }: { items: ShelfCardItem[]; maxRows: number }) {
  const capped = items.slice(0, maxRows * 4)

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {capped.map((item) => (
        <ShelfCard key={item.key} item={item} />
      ))}
    </div>
  )
}
