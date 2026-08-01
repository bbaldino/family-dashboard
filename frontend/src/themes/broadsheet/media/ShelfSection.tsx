import { Kicker } from '@/themes/broadsheet/ui/Kicker'
import { ShelfGrid } from './ShelfGrid'
import type { ShelfCardItem } from './ShelfCard'

/** A `Kicker` over a capped `ShelfGrid` — one shelf, per the design mock
 *  (`media.jsx:131-149`). Renders nothing at all when `items` is empty,
 *  rather than an empty heading over a blank grid — this project's standing
 *  rule against rendering data it doesn't have. */
export function ShelfSection({
  title,
  titleColor,
  items,
  maxRows,
}: {
  title: string
  titleColor?: string
  items: ShelfCardItem[]
  maxRows: number
}) {
  if (items.length === 0) return null

  return (
    <div>
      <Kicker color={titleColor}>{title}</Kicker>
      <div style={{ marginTop: 8 }}>
        <ShelfGrid items={items} maxRows={maxRows} />
      </div>
    </div>
  )
}
