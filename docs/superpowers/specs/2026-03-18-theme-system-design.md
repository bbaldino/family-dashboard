# Theme System Design

## Goal

Replace hardcoded hex colors throughout the dashboard with a structured, two-layer theme system that enables full palette swaps (including future dark mode) by changing a single set of CSS variables.

## Architecture

### Two-layer color system

**Layer 1: Semantic roles** — colors with fixed UI meaning. Components reference these for states that have universal meaning across any theme.

| Variable | Purpose | Default (earth tone theme) |
|----------|---------|---------------------------|
| `--color-primary` | Brand/main interactive color | `#c06830` |
| `--color-secondary` | Supporting accent | `#4a7a9a` |
| `--color-success` | Positive states (completed, delivered, final) | `#4caf50` |
| `--color-warning` | Caution states (tomorrow, upcoming) | `#c06830` |
| `--color-error` | Negative states (live, exceptions, errors) | `#e53935` |
| `--color-info` | Informational (all-day events, neutral highlights) | `#4a7a9a` |

**Layer 2: Palette slots** — an assignable pool of colors for dynamic use. Widgets, calendar sources, chart series, and any feature needing N distinct colors draws from this pool.

| Variable | Default |
|----------|---------|
| `--color-palette-1` | `#c06830` (warm orange) |
| `--color-palette-2` | `#4a8a4a` (sage green) |
| `--color-palette-3` | `#4a7a9a` (slate blue) |
| `--color-palette-4` | `#9a7a30` (gold/ochre) |
| `--color-palette-5` | `#8a5a9a` (muted purple) |
| `--color-palette-6` | `#c04040` (warm red) |
| `--color-palette-7` | `#2a7a5a` (teal) |
| `--color-palette-8` | `#aa6a7a` (dusty rose) |

### Text tiers

| Variable | Purpose | Default |
|----------|---------|---------|
| `--color-text-primary` | Main content text | `#2a2520` (exists) |
| `--color-text-secondary` | Supporting text | `#7a6a5a` (exists) |
| `--color-text-muted` | Deemphasized text | `#b0a89e` (exists) |
| `--color-text-disabled` | Inactive/dimmed content (losing scores, delivered items) | `#c0b8ae` (new) |

### Border tiers

| Variable | Purpose | Default |
|----------|---------|---------|
| `--color-border` | Standard borders | existing value |
| `--color-border-subtle` | Softer internal dividers within cards | `#f0ece6` (new) |

### Surface tiers

No changes — existing `bg-primary`, `bg-card`, `bg-card-hover`, `bg-overlay` are sufficient.

## Widget category mapping

`WidgetCard` currently maps category names directly to category-named CSS variables (`--color-calendar`, `--color-chores`, etc.). This mapping moves to reference palette slots instead:

```typescript
const categoryColors: Record<CardCategory, string> = {
  calendar: 'var(--color-palette-1)',   // warm orange
  chores:   'var(--color-palette-2)',   // sage green
  info:     'var(--color-palette-3)',   // slate blue
  food:     'var(--color-palette-4)',   // gold
  grocery:  'var(--color-palette-5)',   // purple
  sports:   'var(--color-palette-6)',   // warm red
}
```

The category names stay in the code (they're semantic to the dashboard), but the actual colors come from the theme's palette. A theme author changes `--color-palette-1` and every widget using that slot shifts.

## Hardcoded colors to replace

All hardcoded hex values in components get replaced with theme tokens:

**GameCard.tsx / GameDetailModal.tsx:**
- `#c0b8ae` (dimmed/losing score text) → `text-disabled`
- `#d0c8c0` (score dash separator) → `text-disabled`
- `#f5f2ed` (internal border) → `border-subtle`

**DayCell.tsx:**
- `#2a7a5a` (timed event pill color) → `palette-7`

**ShipmentRow.tsx:**
- `#c06830` (tomorrow ETA color) → `warning`

**PackageDetailModal.tsx:**
- `#d0ccc6` (timeline dot inactive) → `text-disabled`
- `#e8e4de` (timeline line) → `border-subtle`

**GameCard.tsx:**
- `rgba(229,57,53,0.03)` (live game tint) → `color-mix` with `error`

## Migration strategy

1. Add all new variables to `variables.css` alongside existing ones
2. Add backward-compatible aliases: `--color-calendar: var(--color-palette-1)`, etc.
3. Update `WidgetCard` category mapping to use palette slots
4. Sweep components to replace hardcoded hexes
5. Remove old category-named aliases once all references are updated
6. No visual changes at any step — purely structural

## What a theme author defines

A complete theme is ~20 CSS variable values:

- 6 semantic roles
- 8 palette slots
- 4 text tiers
- 2 border tiers

Plus the existing surface tiers (bg-primary, bg-card, etc.) which are already theme variables.

## Future considerations

- **Dark mode:** Define a `.dark` class or `prefers-color-scheme` media query that swaps all ~20 values
- **Per-calendar colors:** Each Google Calendar source gets assigned a palette slot (1-8). The mapping is stored in config, not hardcoded.
- **User-customizable themes:** Could expose palette picker in settings UI
- **Additional palette slots:** Easy to add `palette-9`, `palette-10` etc. if 8 proves insufficient
