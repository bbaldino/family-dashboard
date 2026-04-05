# Cell-Based Grid Layout Engine

## Goal

Replace the hardcoded flex-based layout (MagazineLayout / GridLayout) with a configurable cell grid. Widgets declare their shape and size preferences, and the layout engine maps them to cell spans and places them on the grid.

## Grid Framework

**Settings:**
- `dashboard.columns` — number of grid columns (default 6)
- `dashboard.rows` — number of grid rows (default 4)

Cell size is derived: `available_width / columns` and `available_height / rows`. The grid renders as a CSS Grid with `grid-template-columns: repeat(N, 1fr)` and `grid-template-rows: repeat(M, 1fr)`.

## Widget Size Preferences

Widgets no longer declare `compact` / `standard` / `expanded`. Instead they declare shape and relative size:

```typescript
interface WidgetSizePreference {
  orientation: 'vertical' | 'horizontal' | 'square'
  relativeSize: 'small' | 'medium' | 'large'
}
```

The layout engine maps these to cell spans based on the current grid dimensions. Example mappings for a 6×4 grid:

| orientation | relativeSize | colSpan | rowSpan | Notes |
|------------|-------------|---------|---------|-------|
| square | small | 1 | 1 | Compact filler |
| square | medium | 2 | 2 | Standard widget |
| square | large | 3 | 3 | Hero widget |
| vertical | medium | 1 | 2 | Countdown list |
| vertical | large | 1 | 4 | Calendar (full height) |
| horizontal | medium | 2 | 1 | Wide short widget |
| horizontal | large | 3 | 2 | Wide hero |

The spans are computed from grid dimensions using these rules:

```
smallSpan  = max(1, floor(min(cols, rows) / 6))  // ~1 on most grids
mediumSpan = max(1, floor(min(cols, rows) / 3))  // ~2 on a 6×4 grid
largeSpan  = max(1, floor(min(cols, rows) / 2))  // ~3 on a 6×4 grid
```

Then orientation maps the span to columns × rows:
- `square`: colSpan = span, rowSpan = span
- `vertical`: colSpan = smallSpan, rowSpan = span (or grid rows for `large`)
- `horizontal`: colSpan = span, rowSpan = smallSpan

## Anchoring

Widgets can optionally declare a fixed position:

```typescript
anchor?: {
  column: number  // 1-based starting column
  row: number     // 1-based starting row
}
```

Anchored widgets are placed first at their declared position with their computed span. Non-anchored widgets fill remaining space by priority order.

## Calendar as a Grid Widget

The calendar is no longer special-cased in HomeBoard. It becomes a widget in the grid:

- `orientation: 'vertical'`
- `relativeSize: 'large'`
- `anchor: { column: 1, row: 1 }`

This gives it the left column, full height — same visual result as today, but now part of the grid system.

## Layout Engine

`resolveLayout` is simplified. Input: list of widgets with their `WidgetMeta` (visibility, priority) and `WidgetSizePreference`. Output: flat list of placed widgets with grid positions.

**Algorithm:**
1. Filter invisible widgets
2. Compute cell spans from each widget's size preference + grid dimensions
3. Place anchored widgets first at their declared positions, marking those cells as occupied
4. Sort remaining widgets by priority (descending)
5. For each widget, find the first available region that fits its span (scan top-left to bottom-right, row by row)
6. If the widget doesn't fit at preferred size, shrink the span by one step and retry
7. If it doesn't fit at minimum (1×1), the widget is dropped

**Rendering:** Each placed widget gets explicit `grid-column: start / span` and `grid-row: start / span` styles on a CSS Grid container.

## Filler Distribution

The HomeBoard filler distribution logic (content vs filler widgets, meta widget for overflow) changes from counting against `MAX_WIDGET_SLOTS` to counting against available cells:

- Compute total cells: `columns × rows`
- Subtract cells used by anchored widgets and content widgets
- Remaining cells determine how many fillers fit (each filler needs `small` span worth of cells)
- Same distribution logic: if not enough room for all fillers, bundle overflow into meta widget

`MAX_WIDGET_SLOTS` constant is removed.

## WidgetMeta Changes

The `WidgetMeta` type updates:

```typescript
type WidgetMeta =
  | { visible: false }
  | {
      visible: true
      priority: number
      sizePreference: WidgetSizePreference
      anchor?: { column: number; row: number }
    }
```

The old `preferredSize: WidgetSize` field is replaced by `sizePreference`. Each widget's `useWidgetMeta` hook updates to return the new shape.

## Files

### New files

| File | Responsibility |
|------|---------------|
| `frontend/src/boards/layouts/CellGridLayout.tsx` | Grid rendering with CSS Grid cell placement |
| `frontend/src/boards/layouts/gridEngine.ts` | Placement algorithm: compute spans, place anchored, pack by priority |
| `frontend/src/integrations/google-calendar/useWidgetMeta.ts` | Calendar widget meta (vertical, large, anchored left) |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/lib/widget-types.ts` | Replace `WidgetSize` with `WidgetSizePreference`, update `WidgetMeta` |
| `frontend/src/boards/HomeBoard.tsx` | Remove calendar special-case, remove `MAX_WIDGET_SLOTS`, use `CellGridLayout`, update filler distribution to use cell count |
| `frontend/src/boards/layouts/MagazineLayout.tsx` | Remove (replaced by CellGridLayout) |
| `frontend/src/boards/layouts/GridLayout.tsx` | Remove (replaced by CellGridLayout) |
| `frontend/src/integrations/sports/useWidgetMeta.ts` | Update to return `sizePreference` |
| `frontend/src/integrations/packages/useWidgetMeta.ts` | Update to return `sizePreference` |
| `frontend/src/integrations/chores/useWidgetMeta.ts` | Update to return `sizePreference` |
| `frontend/src/integrations/countdowns/useWidgetMeta.ts` | Update to return `sizePreference` |
| `frontend/src/integrations/nutrislice/useWidgetMeta.ts` | Update to return `sizePreference` |
| `frontend/src/integrations/on-this-day/useWidgetMeta.ts` | Update to return `sizePreference` |
| `frontend/src/integrations/word-of-the-day/useWidgetMeta.ts` | Update to return `sizePreference` |
| `frontend/src/integrations/daily-quote/useWidgetMeta.ts` | Update to return `sizePreference` |
| `frontend/src/integrations/trivia/useWidgetMeta.ts` | Update to return `sizePreference` |
| `frontend/src/integrations/jokes/useWidgetMeta.ts` | Update to return `sizePreference` |
| `frontend/src/integrations/dashboard/DashboardSettings.tsx` | Add rows/columns settings, remove layout mode picker |
| `frontend/src/ui/WidgetCard.tsx` | Remove `size` prop handling if no longer needed |

### Removed files

| File | Reason |
|------|--------|
| `frontend/src/boards/layouts/MagazineLayout.tsx` | Replaced by CellGridLayout |
| `frontend/src/boards/layouts/GridLayout.tsx` | Replaced by CellGridLayout |
