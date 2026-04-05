import { cloneElement } from 'react'
import type { MagazineWidget } from './MagazineLayout'

interface GridLayoutProps {
  widgets: MagazineWidget[]
}

export function GridLayout({ widgets }: GridLayoutProps) {
  return (
    <div
      className="flex-1 grid grid-cols-3 grid-rows-2 gap-[var(--spacing-grid-gap)] min-h-0"
      style={{ gridAutoFlow: 'dense' }}
    >
      {widgets.map((w) =>
        cloneElement(w.element, { size: 'standard' as const, key: w.key } as Record<string, unknown>),
      )}
    </div>
  )
}
