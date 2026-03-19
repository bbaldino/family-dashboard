# Theme Settings Design

## Goal

Add a theme settings page where users can select between preset themes, create custom themes, and edit individual colors with a live preview of the dashboard.

## Data Model

### Storage

Only custom themes are stored in the config table. Built-in presets are hardcoded in the frontend.

- `theme.active` — ID of the active theme (string). Defaults to `"earth-tones"` if not set.
- `theme.custom_themes` — JSON array of custom theme objects (only user-created themes)

### Theme object

```typescript
interface ThemeColors {
  palette: string[]  // exactly 8 hex colors (palette-1 through palette-8)
  roles: {
    success: string
    warning: string
    error: string
    info: string
  }
  surfaces: {
    background: string   // maps to --color-bg-primary
    card: string          // maps to --color-bg-card
    cardHover: string     // maps to --color-bg-card-hover
  }
  text: {
    primary: string       // maps to --color-text-primary
    secondary: string     // maps to --color-text-secondary
    muted: string         // maps to --color-text-muted
    disabled: string      // maps to --color-text-disabled
  }
  border: {
    default: string       // maps to --color-border (note: also used by shadcn utilities)
    subtle: string        // maps to --color-border-subtle
  }
}

interface Theme {
  id: string           // unique ID
  name: string         // display name
  builtin: boolean     // true for presets (read-only, can't delete/rename)
  colors: ThemeColors
}
```

### CSS variable mapping

When applying a theme, each field maps to a CSS variable on `:root`:

| Theme field | CSS variable |
|------------|-------------|
| `palette[0]` through `palette[7]` | `--color-palette-1` through `--color-palette-8` |
| `roles.success` | `--color-role-success` |
| `roles.warning` | `--color-role-warning` |
| `roles.error` | `--color-role-error` |
| `roles.info` | `--color-role-info` |
| `surfaces.background` | `--color-bg-primary` |
| `surfaces.card` | `--color-bg-card` |
| `surfaces.cardHover` | `--color-bg-card-hover` |
| `text.primary` | `--color-text-primary` |
| `text.secondary` | `--color-text-secondary` |
| `text.muted` | `--color-text-muted` |
| `text.disabled` | `--color-text-disabled` |
| `border.default` | `--color-border-subtle` parent block override |
| `border.subtle` | `--color-border-subtle` |

**Out of scope for theming (v1):** `--color-bg-overlay`, `--color-separator`, all `--radius-*`, `--shadow-*`, `--spacing-*`, `--height-*` variables, and all shadcn oklch variables. These use their CSS defaults. Dark mode theming (which requires shadcn variable overrides) is deferred.

### Validation

- `palette` must be exactly 8 entries
- All color values must be valid hex strings (`#` + 6 hex chars)
- `id` must be unique, non-empty, alphanumeric + hyphens
- `name` must be non-empty
- Invalid colors fall back to the CSS defaults from `variables.css`

## Built-in Presets

Hardcoded in the frontend. Not stored in the database.

**Earth Tones** (current default, id: `earth-tones`):
- Palette: `#c06830`, `#4a8a4a`, `#4a7a9a`, `#9a7a30`, `#8a5a9a`, `#c04040`, `#2a7a5a`, `#aa6a7a`
- Warm beige background (`#f3efe9`), white cards, brown text hierarchy

**Ocean** (id: `ocean`):
- Palette: blues, teals, sea greens
- Cool gray background, white cards, slate text

Built-in presets are read-only. To customize a preset, use "+ New Theme" which copies it as a custom theme.

## Architecture

### No backend changes

Themes are stored via the existing config CRUD API (`GET /api/config`, `PUT /api/config/{key}`). No new endpoints needed.

### Frontend

**`useTheme` hook** — manages theme state:
1. On app load, reads `theme.active` and `theme.custom_themes` from config
2. Merges custom themes with hardcoded presets to build the full theme list
3. Applies the active theme's colors as CSS variable overrides on `document.documentElement.style`
4. If `theme.active` references a missing theme, falls back to `"earth-tones"`
5. Exposes: `activeTheme`, `allThemes`, `setActiveTheme()`, `applyPreview(colors)`, `clearPreview()`

**`ThemeSettings` component** — registered as a `settingsComponent` for a `theme` integration. Contains:

- **Theme selector** — horizontal chips showing all themes (presets + custom) with color dot previews. Active theme highlighted. "+ New Theme" button creates a copy of the current theme as a new custom theme.
- **Color editor** — three grouped sections ("Palette", "Roles", "Surfaces, Text & Borders") in a two-column compact grid. Each row: color swatch (tappable) + label + hex value. Tapping a swatch opens a native `<input type="color">` picker.
- **Live preview** — a static mini-dashboard mockup (matching the brainstorm mockup) rendered in a CSS-variable-scoped container. The preview wrapper div has all theme CSS variables set as inline styles, so changing a color instantly updates the preview without affecting the main page. A dropdown switches between preview layouts (Home Board, Calendar). The preview uses representative static content, not live widget data.
- **Actions** — Save (persists to config), Reset (reverts to last saved state), Delete (custom themes only, with confirmation)

### Theme application flow

1. App loads → `useTheme` fetches config
2. Build theme list: hardcoded presets + custom themes from `theme.custom_themes`
3. Find active theme by `theme.active` ID (default: `"earth-tones"`)
4. Apply colors to `document.documentElement.style` as CSS variable overrides
5. In settings editor: `applyPreview(editedColors)` updates `:root` immediately for live feedback
6. On save: persist `theme.active` and `theme.custom_themes` to config API
7. On discard/navigate away: `clearPreview()` restores the saved active theme

## Settings Integration

```typescript
export const themeIntegration = defineIntegration({
  id: 'theme',
  name: 'Theme',
  hasBackend: false,
  schema: z.object({}),
  fields: {},
  settingsComponent: ThemeSettings,
})
```

## Deferred

- Dark mode preset (requires shadcn/Tailwind oklch variable overrides)
- Theme import/export (JSON file)
- Live component rendering in preview (v1 uses static mockup)
- Custom color picker UI (v1 uses native `<input type="color">`)
- Theming radius, shadow, spacing values
