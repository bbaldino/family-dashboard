# Theme System Design

## Goal

Replace hardcoded hex colors throughout the dashboard with a structured, two-layer theme system that enables full palette swaps (including future dark mode) by changing a single set of CSS variables.

## Architecture

### Two-layer color system

**Layer 1: Semantic roles** — colors with fixed UI meaning. Components reference these for states that have universal meaning across any theme. These are namespaced with `--color-role-*` to avoid collision with shadcn/Tailwind's existing `--color-primary`, `--color-secondary`, etc.

| Variable | Purpose | Default (earth tone theme) |
|----------|---------|---------------------------|
| `--color-role-success` | Positive states (completed, delivered, final) | `#4caf50` (already exists as `--color-success`) |
| `--color-role-warning` | Caution states (tomorrow, upcoming) | `#c06830` |
| `--color-role-error` | Negative states (live, exceptions, errors) | `#e53935` (already exists as `--color-error`) |
| `--color-role-info` | Informational (all-day events, neutral highlights) | `#4a7a9a` |

Note: `--color-success` and `--color-error` already exist in the theme. We alias them: `--color-role-success: var(--color-success)`, etc. This avoids duplication while giving a consistent `role-*` naming pattern.

We intentionally omit `--color-role-primary` and `--color-role-secondary` — those concepts are covered by the palette slots. A widget's "primary" color is whichever palette slot it's assigned, not a global semantic role.

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
| `--color-border` | Standard borders | existing shadcn value (unchanged) |
| `--color-border-subtle` | Softer internal dividers within cards | `#f0ece6` (new) |

The existing `--color-separator` (`rgba(0,0,0,0.08)`) is kept as-is — it's used for the HeroStrip divider lines and has a slightly different purpose (transparent overlay separator vs. opaque border). No change needed.

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
- `rgba(229,57,53,0.03)` (live game tint) → `color-mix` with `role-error`

**DayCell.tsx:**
- `#2a7a5a` (timed event pill color, both foreground and background via color-mix) → `palette-7`

**ShipmentRow.tsx:**
- `#c06830` (tomorrow ETA color) → `role-warning`

**PackageDetailModal.tsx:**
- `#d0ccc6` (timeline dot inactive) → `text-disabled`
- `#e8e4de` (timeline line) → `border-subtle`

**Out of scope:**
- `ColorPicker.tsx` / `PeopleTab.tsx` — these contain hardcoded hex palettes for the per-person color picker. These are user-assignable colors, not theme colors.

## Migration strategy

1. Add new variables to the `@theme` block in `variables.css` alongside existing ones: palette slots, `text-disabled`, `border-subtle`, `role-*` aliases
2. Add backward-compatible aliases in the same `@theme` block: `--color-calendar: var(--color-palette-1)`, `--color-chores: var(--color-palette-2)`, etc.
3. Update `WidgetCard` category mapping to use palette slot variables
4. Sweep all components to replace hardcoded hex values with theme tokens
5. Remove old category-named variables (`--color-calendar`, `--color-chores`, `--color-food`, `--color-grocery`, `--color-sports`) once all references are updated. Keep `--color-info` as an alias for `--color-role-info` since it's widely referenced via Tailwind utilities (`text-info`, `bg-info/10`, etc.)
6. No visual changes at any step — purely structural

## What a theme author defines

A complete theme is ~18 CSS variable values:

- 4 semantic roles (success, warning, error, info)
- 8 palette slots
- 4 text tiers
- 2 border tiers

Plus the existing surface tiers (bg-primary, bg-card, etc.) which are already theme variables.

## Future considerations

- **Dark mode:** Define a `.dark` class or `prefers-color-scheme` media query that swaps all values
- **Per-calendar colors:** Each Google Calendar source gets assigned a palette slot (1-8). The mapping is stored in config, not hardcoded.
- **User-customizable themes:** Could expose palette picker in settings UI
- **Additional palette slots:** Easy to add `palette-9`, `palette-10` etc. if 8 proves insufficient
