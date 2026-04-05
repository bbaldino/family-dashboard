# Grid Layout Engine — Future Design Notes

These notes capture thinking from the meta filler widget discussion for when we revisit the layout engine.

## Problem

The current layout is hardcoded CSS ratios (3-column grids, flex ratios for expanded/sidebar/shelf). There's no concept of "how many widgets fit" — the layout just renders whatever it gets. This means:

- No way to calculate available filler slots dynamically
- Adding more widgets just shrinks everything
- No minimum widget size enforcement
- The meta filler widget uses a hardcoded max (6) as a stopgap

## Desired Model

The layout should be cell-based, derived from:

1. **Available pixel space** — screen resolution minus fixed elements (calendar column, hero strip, gaps/padding)
2. **Minimum widget size** — configurable, defines the smallest a widget card can be. Currently large with some wasted whitespace; should be tunable to fit more widgets when desired.
3. **Widget preferred sizes** — expanded widgets consume multiple cells, standard widgets consume one cell

### Calculation

```
available_width = screen_width - calendar_width - gaps
available_height = screen_height - hero_height - timer_banner - gaps
columns = floor(available_width / min_widget_width)
rows = floor(available_height / min_widget_height)
total_cells = columns × rows
```

Expanded widgets consume `expanded_columns × expanded_rows` cells (e.g., 2×2 = 4 cells). Standard widgets consume 1 cell each. The layout engine places expanded widgets first, then fills remaining cells with standard widgets.

### Filler Distribution

With cell counts known:
- Place content widgets (priority > 0) first
- Count remaining cells
- If remaining >= filler count: place all fillers individually
- If remaining < filler count: place (remaining - 1) individual fillers + 1 meta widget for overflow
- If remaining == 1: meta widget cycles through all fillers
- If remaining == 0: no fillers shown

### Compact Size Revisited

When minimum widget size shrinks (future tuning), more cells become available. Some widgets could render in "compact" mode for smaller cells — the compact variants we already built but aren't currently using. The layout engine could assign compact size to widgets in tight cells and standard to widgets in normal cells.

### Configuration

- `dashboard.min_widget_width` — minimum pixel width for a widget cell
- `dashboard.min_widget_height` — minimum pixel height for a widget cell
- These could be tuned per-device (tablet vs wall display)

## What Exists Today

- `MagazineLayout.tsx` — resolves expanded vs equal-rows, assigns sizes, renders with CSS flex/grid
- `GridLayout.tsx` — simple 3×2 grid pass-through
- `HomeBoard.tsx` — wires widgets with meta hooks, currently hardcodes `MAX_WIDGET_SLOTS = 6`
- Compact widget variants exist for all widgets but are unused (layout always assigns standard)
- `WidgetMeta` supports `preferredSize` and the layout engine has `capSize` logic

## Next Steps When We Revisit

1. Measure available space (probably via a `useLayoutMeasure` hook with ResizeObserver)
2. Calculate grid dimensions from available space + min widget size
3. Replace hardcoded layout with cell-based placement
4. Remove `MAX_WIDGET_SLOTS` — derive it from cell count
5. Re-enable compact variants for tight layouts
6. Consider: should min widget size be responsive, or a fixed setting?
