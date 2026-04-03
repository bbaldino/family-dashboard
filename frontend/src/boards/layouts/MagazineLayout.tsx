import { type ReactNode, type ReactElement, Children, isValidElement } from 'react'

interface MagazineLayoutProps {
  children: ReactNode
}

/**
 * Magazine-style layout with a hero card (2× wide) in the top row
 * and flexible bottom row that adapts when widgets are hidden.
 *
 * Children are rendered in order. The first child becomes the hero (big card).
 * The next two stack beside it. The rest flow into the bottom row.
 *
 * When children return null (hidden widgets), the layout adapts:
 * - Bottom row cards stretch to fill available space
 * - If only one bottom card remains, it takes the full width
 */
export function MagazineLayout({ children }: MagazineLayoutProps) {
  const all = Children.toArray(children).filter(
    (child): child is ReactElement => isValidElement(child),
  )

  if (all.length === 0) return null

  // First child = hero (big card), next 2 = sidebar stack, rest = bottom row
  const hero = all[0]
  const sidebar = all.slice(1, 3)
  const bottom = all.slice(3)

  return (
    <div className="flex-1 flex flex-col gap-[var(--spacing-grid-gap)] min-h-0">
      {/* Top row: hero card (2/3) + stacked sidebar (1/3) — takes 60% */}
      <div className="flex gap-[var(--spacing-grid-gap)] min-h-0" style={{ flex: '3 1 0%' }}>
        <div className="flex-[2] min-h-0 overflow-hidden">{hero}</div>
        {sidebar.length > 0 && (
          <div className="flex-1 flex flex-col gap-[var(--spacing-grid-gap)] min-h-0">
            {sidebar.map((child, i) => (
              <div key={i} className="flex-1 min-h-0 overflow-hidden">
                {child}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom row: remaining widgets — takes 40% */}
      {bottom.length > 0 && (
        <div className="flex gap-[var(--spacing-grid-gap)] min-h-0" style={{ flex: '2 1 0%' }}>
          {bottom.map((child, i) => (
            <div key={i} className="flex-1 min-h-0 overflow-hidden">
              {child}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
