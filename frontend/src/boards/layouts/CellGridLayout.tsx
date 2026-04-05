import type { ReactElement } from 'react'
import type { WidgetMeta } from '@/lib/widget-types'
import { placeWidgets, type GridConfig, type GridWidget } from './gridEngine'

export interface CellGridWidget {
  key: string
  element: ReactElement
  meta: WidgetMeta
}

interface CellGridLayoutProps {
  widgets: CellGridWidget[]
  columns: number
  rows: number
}

export function CellGridLayout({ widgets, columns, rows }: CellGridLayoutProps) {
  const grid: GridConfig = { columns, rows }

  const gridWidgets: GridWidget[] = widgets.filter(
    (w): w is CellGridWidget & { meta: WidgetMeta & { visible: true } } => w.meta.visible,
  )

  const { placed } = placeWidgets(gridWidgets, grid)

  if (placed.length === 0) return null

  return (
    <div
      className="flex-1 grid gap-[var(--spacing-grid-gap)] min-h-0"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {placed.map((w) => (
        <div
          key={w.key}
          className="min-h-0 overflow-hidden"
          style={{
            gridColumn: `${w.colStart} / span ${w.colSpan}`,
            gridRow: `${w.rowStart} / span ${w.rowSpan}`,
          }}
        >
          {w.element}
        </div>
      ))}
    </div>
  )
}
