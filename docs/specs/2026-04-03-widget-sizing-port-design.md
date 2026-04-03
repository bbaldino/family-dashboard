# Porting Adaptive Widget Sizing to All Widgets

## Goal

Extend the adaptive widget sizing system (built for Sports) to all dashboard widgets. Each widget declares whether it has content to show, what size it prefers, and its priority. The layout engine uses this to dynamically compose the magazine layout.

## Updated WidgetMeta Type

The current `WidgetMeta` interface is replaced with a discriminated union:

```typescript
type WidgetMeta =
  | { visible: false }
  | { visible: true; preferredSize: WidgetSize; priority: number }
```

- `visible: false` — widget has nothing to show; the layout engine skips it entirely.
- `visible: true` — widget wants a slot. `preferredSize` is what it'd like; `priority` determines who wins when multiple widgets want expanded.

`supportedSizes` and `anchor` are removed. `DEFAULT_WIDGET_META` becomes `{ visible: true, preferredSize: 'standard', priority: 0 }`.

The per-widget `maxSize` config override still applies — it caps `preferredSize` before the engine runs.

## Widget Visibility and Priority

Each widget gets a `useWidgetMeta` hook that inspects its own data:

| Widget | Visible when | preferredSize | Priority | Notes |
|--------|-------------|---------------|----------|-------|
| Sports | Has any games (live/final/upcoming) | expanded (live/upcoming today), standard (final/upcoming) | 10 (live), 5 (upcoming today), 3 (upcoming), 2 (final) | Already implemented |
| Packages | Has active or recently delivered shipments | standard | 5 (delivery today), 3 (active shipments) | |
| Chores | Has any assignments (done or incomplete) | standard | 4 | |
| Countdowns | Has events within display horizon | standard | 2 | |
| Lunch Menu | Has menu data for today or tomorrow | expanded (has today's data), standard (tomorrow only) | 4 | |
| On This Day | Always (Wikipedia always has content) | standard | 0 | Ultimate filler widget |

When no widget requests expanded, the layout engine falls back to equal-rows (3×2 grid, all standard).

## Size Variants Per Widget

### Expanded (hero slot)

Only Sports and Lunch Menu have expanded renders:

- **Sports** — already built: featured game with linescore/leaders, remaining games, AI preview.
- **Lunch Menu** — next 5 school days of menus.

### Standard

Current rendering for all widgets. No changes needed.

### Compact (sidebar slot)

When a widget lands in a sidebar slot because another widget won expanded:

- **Sports** — already built: single-line game rows, max 3.
- **Packages** — top 3 packages as single-line rows: name + status badge. No delivery dates, no delivered section.
- **Chores** — summary only: one line per person showing "Name: X/Y done". No individual chore list.
- **Countdowns** — top 3 events, name + "X days", smaller text.
- **Lunch Menu** — single day only (today, or tomorrow if today has no data). Main entrees only, no alternatives/extras.
- **On This Day** — year + first line of event text, truncated.

### Tap-to-expand on compact cards

Compact cards lose detail that's normally visible. Tapping a compact widget card opens a BottomSheet with the standard view of that widget's content.

`WidgetCard` already has a `detail` prop that opens a `BottomSheet` on tap. Widgets pass their standard render as `detail` when in compact mode.

## Layout Engine Changes

The layout engine (`resolveLayout` in `MagazineLayout.tsx`) needs minor updates:

1. Filter out widgets with `visible: false` before sorting.
2. If fewer than 6 widgets are visible, the layout has fewer cards (no empty slots).
3. The `capSize` function and priority sorting work as-is.

## Files Changed

### New files

| File | Responsibility |
|------|---------------|
| `frontend/src/integrations/packages/useWidgetMeta.ts` | Packages meta hook |
| `frontend/src/integrations/chores/useWidgetMeta.ts` | Chores meta hook |
| `frontend/src/integrations/countdowns/useWidgetMeta.ts` | Countdowns meta hook |
| `frontend/src/integrations/nutrislice/useWidgetMeta.ts` | Lunch menu meta hook |
| `frontend/src/integrations/on-this-day/useWidgetMeta.ts` | On This Day meta hook |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/lib/widget-types.ts` | Replace `WidgetMeta` with discriminated union, update `DEFAULT_WIDGET_META` |
| `frontend/src/boards/layouts/MagazineLayout.tsx` | Filter invisible widgets, handle fewer than 6 |
| `frontend/src/boards/HomeBoard.tsx` | Wire all widget meta hooks, remove `DEFAULT_WIDGET_META` usage |
| `frontend/src/integrations/sports/useWidgetMeta.ts` | Adapt to new `WidgetMeta` shape (add `visible` field) |
| `frontend/src/integrations/packages/PackagesWidget.tsx` | Accept `size` prop, render compact variant, pass `detail` for bottom sheet |
| `frontend/src/integrations/chores/ChoresWidget.tsx` | Accept `size` prop, render compact variant, pass `detail` for bottom sheet |
| `frontend/src/integrations/countdowns/CountdownsWidget.tsx` | Accept `size` prop, render compact variant, pass `detail` for bottom sheet |
| `frontend/src/integrations/nutrislice/LunchMenuWidget.tsx` | Accept `size` prop, render compact/expanded variants, pass `detail` for bottom sheet |
| `frontend/src/integrations/on-this-day/OnThisDayWidget.tsx` | Accept `size` prop, render compact variant, pass `detail` for bottom sheet |
