import type { ReactElement } from 'react'
import type { WidgetMeta, WidgetSizePreference, RelativeSize } from '@/lib/widget-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GridConfig {
  columns: number
  rows: number
}

export interface GridWidget {
  key: string
  element: ReactElement
  meta: WidgetMeta & { visible: true }
}

export interface PlacedWidget {
  key: string
  element: ReactElement
  colStart: number // 1-based CSS Grid coordinate
  rowStart: number // 1-based CSS Grid coordinate
  colSpan: number
  rowSpan: number
}

interface Span {
  colSpan: number
  rowSpan: number
}

// ---------------------------------------------------------------------------
// Span computation
// ---------------------------------------------------------------------------

export function computeSpan(pref: WidgetSizePreference, grid: GridConfig): Span {
  // Compute spans independently for each axis
  // Ensure each size is strictly larger than the previous
  const colSpans: Record<RelativeSize, number> = {
    small: 1,
    medium: Math.max(2, Math.round(grid.columns / 4)),
    large: Math.max(3, Math.round(grid.columns / 3)),
    xlarge: Math.max(4, Math.round(grid.columns / 2)),
  }
  const rowSpans: Record<RelativeSize, number> = {
    small: 1,
    medium: Math.max(2, Math.round(grid.rows / 4)),
    large: Math.max(2, Math.round(grid.rows / 3)),
    xlarge: Math.max(3, Math.round(grid.rows / 2)),
  }

  const cs = colSpans[pref.relativeSize]
  const rs = rowSpans[pref.relativeSize]

  switch (pref.orientation) {
    case 'square':
      return { colSpan: cs, rowSpan: rs }
    case 'vertical': {
      const isLargeOrXl = pref.relativeSize === 'large' || pref.relativeSize === 'xlarge'
      const vCols = isLargeOrXl ? Math.max(1, Math.round(grid.columns / 4)) : 1
      return {
        colSpan: vCols,
        rowSpan: isLargeOrXl ? grid.rows : rs,
      }
    }
    case 'horizontal': {
      if (pref.relativeSize === 'xlarge') {
        return {
          colSpan: Math.max(2, Math.floor(grid.columns / 2)),
          rowSpan: Math.max(2, Math.floor(grid.rows / 2)),
        }
      }
      const hCols = pref.relativeSize === 'large' ? Math.max(2, Math.round(grid.columns / 3)) : cs
      const hRows = pref.relativeSize === 'large' ? Math.max(1, Math.round(grid.rows / 3)) : 1
      return { colSpan: hCols, rowSpan: hRows }
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function countFreeCells(occupied: boolean[][]): number {
  let count = 0
  for (const row of occupied) {
    for (const cell of row) {
      if (!cell) count++
    }
  }
  return count
}

function createOccupiedGrid(rows: number, columns: number): boolean[][] {
  return Array.from({ length: rows }, () => Array<boolean>(columns).fill(false))
}

function markOccupied(
  occupied: boolean[][],
  row0: number,
  col0: number,
  rowSpan: number,
  colSpan: number,
): void {
  for (let r = row0; r < row0 + rowSpan; r++) {
    for (let c = col0; c < col0 + colSpan; c++) {
      occupied[r][c] = true
    }
  }
}

function regionFits(
  occupied: boolean[][],
  row0: number,
  col0: number,
  rowSpan: number,
  colSpan: number,
  gridRows: number,
  gridCols: number,
): boolean {
  if (row0 + rowSpan > gridRows || col0 + colSpan > gridCols) return false
  for (let r = row0; r < row0 + rowSpan; r++) {
    for (let c = col0; c < col0 + colSpan; c++) {
      if (occupied[r][c]) return false
    }
  }
  return true
}

function findFreeRegion(
  occupied: boolean[][],
  rowSpan: number,
  colSpan: number,
  gridRows: number,
  gridCols: number,
): { row: number; col: number } | null {
  // Scan row-first: fill left-to-right, top-to-bottom
  for (let r = 0; r <= gridRows - rowSpan; r++) {
    for (let c = 0; c <= gridCols - colSpan; c++) {
      if (regionFits(occupied, r, c, rowSpan, colSpan, gridRows, gridCols)) {
        return { row: r, col: c }
      }
    }
  }
  return null
}

function shrinkSize(size: RelativeSize): RelativeSize | null {
  switch (size) {
    case 'xlarge':
      return 'large'
    case 'large':
      return 'medium'
    case 'medium':
      return 'small'
    case 'small':
      return null
  }
}

// ---------------------------------------------------------------------------
// Main placement algorithm
// ---------------------------------------------------------------------------

export function placeWidgets(
  widgets: GridWidget[],
  grid: GridConfig,
): { placed: PlacedWidget[]; freeCells: number } {
  const occupied = createOccupiedGrid(grid.rows, grid.columns)
  const placed: PlacedWidget[] = []

  // Separate anchored vs. unanchored widgets
  const anchored: GridWidget[] = []
  const unanchored: GridWidget[] = []

  for (const w of widgets) {
    if (w.meta.anchor) {
      anchored.push(w)
    } else {
      unanchored.push(w)
    }
  }

  // 1. Place anchored widgets first
  for (const w of anchored) {
    const anchor = w.meta.anchor!
    const span = computeSpan(w.meta.sizePreference, grid)
    // anchor is 1-based, convert to 0-based
    const row0 = anchor.row - 1
    const col0 = anchor.column - 1

    if (regionFits(occupied, row0, col0, span.rowSpan, span.colSpan, grid.rows, grid.columns)) {
      markOccupied(occupied, row0, col0, span.rowSpan, span.colSpan)
      placed.push({
        key: w.key,
        element: w.element,
        colStart: col0 + 1, // back to 1-based for CSS Grid
        rowStart: row0 + 1,
        colSpan: span.colSpan,
        rowSpan: span.rowSpan,
      })
    }
  }

  // 2. Sort remaining by priority descending
  const sorted = [...unanchored].sort((a, b) => b.meta.priority - a.meta.priority)

  // 3. Place each widget, shrinking if needed
  for (const w of sorted) {
    let currentSize: RelativeSize | null = w.meta.sizePreference.relativeSize

    while (currentSize !== null) {
      const pref: WidgetSizePreference = {
        orientation: w.meta.sizePreference.orientation,
        relativeSize: currentSize,
      }
      const span = computeSpan(pref, grid)
      const pos = findFreeRegion(occupied, span.rowSpan, span.colSpan, grid.rows, grid.columns)

      if (pos) {
        markOccupied(occupied, pos.row, pos.col, span.rowSpan, span.colSpan)
        placed.push({
          key: w.key,
          element: w.element,
          colStart: pos.col + 1,
          rowStart: pos.row + 1,
          colSpan: span.colSpan,
          rowSpan: span.rowSpan,
        })
        break
      }

      currentSize = shrinkSize(currentSize)
    }
    // If currentSize became null, widget is dropped (doesn't fit at any size)
  }

  // 4. Expand widgets to fill adjacent empty cells
  expandToFillGaps(placed, occupied, grid)

  return { placed, freeCells: countFreeCells(occupied) }
}

/**
 * After placement, try to grow each widget downward and rightward
 * to fill adjacent empty cells. This reduces visual gaps.
 */
function expandToFillGaps(
  placed: PlacedWidget[],
  occupied: boolean[][],
  grid: GridConfig,
): void {
  // Try expanding each widget (in reverse priority order — lower priority widgets expand first
  // so they fill gaps without stealing space from important widgets)
  for (const w of [...placed].reverse()) {
    const row0 = w.rowStart - 1
    const col0 = w.colStart - 1

    // Try expanding down
    while (row0 + w.rowSpan < grid.rows) {
      const newRow = row0 + w.rowSpan
      let canExpand = true
      for (let c = col0; c < col0 + w.colSpan; c++) {
        if (occupied[newRow][c]) {
          canExpand = false
          break
        }
      }
      if (!canExpand) break
      // Mark the new row as occupied
      for (let c = col0; c < col0 + w.colSpan; c++) {
        occupied[newRow][c] = true
      }
      w.rowSpan++
    }

    // Try expanding right
    while (col0 + w.colSpan < grid.columns) {
      const newCol = col0 + w.colSpan
      let canExpand = true
      for (let r = row0; r < row0 + w.rowSpan; r++) {
        if (occupied[r][newCol]) {
          canExpand = false
          break
        }
      }
      if (!canExpand) break
      for (let r = row0; r < row0 + w.rowSpan; r++) {
        occupied[r][newCol] = true
      }
      w.colSpan++
    }
  }
}
