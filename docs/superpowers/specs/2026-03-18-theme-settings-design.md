# Theme Settings Design

## Goal

Add a theme settings page where users can select between preset themes, create custom themes, and edit individual colors with a live preview of the dashboard.

## Data Model

Themes are stored as JSON in the config table (consistent with all other settings):

- `theme.active` — ID of the active theme (string)
- `theme.themes` — JSON array of theme objects

A theme object:
```typescript
interface Theme {
  id: string           // unique ID (e.g. "earth-tones", "custom-1")
  name: string         // display name
  builtin: boolean     // true for presets (can't be deleted or renamed)
  colors: {
    palette: string[]  // 8 hex colors (palette-1 through palette-8)
    roles: {
      success: string
      warning: string
      error: string
      info: string
    }
    surfaces: {
      background: string
      card: string
      cardHover: string
    }
    text: {
      primary: string
      secondary: string
      muted: string
      disabled: string
    }
    border: {
      default: string
      subtle: string
    }
  }
}
```

## Built-in Presets

Ship with 2-3 presets:

**Earth Tones** (current default):
- Palette: `#c06830`, `#4a8a4a`, `#4a7a9a`, `#9a7a30`, `#8a5a9a`, `#c04040`, `#2a7a5a`, `#aa6a7a`
- Warm beige background, cream cards, brown text

**Ocean:**
- Palette: blues, teals, sea greens
- Cool gray background, white cards

Additional presets can be added later.

## Architecture

### No backend changes

Themes are stored via the existing config CRUD API (`GET /api/config`, `PUT /api/config/{key}`). No new endpoints needed.

### Frontend

**Theme application** — a `ThemeProvider` component (or hook) that:
1. On app load, reads `theme.active` and `theme.themes` from config
2. Applies the active theme's colors as CSS variable overrides on `document.documentElement`
3. Exposes a function to switch themes or update colors (for the editor's live preview)

The CSS variables in `variables.css` serve as defaults. The ThemeProvider overrides them at runtime via inline styles on `:root`.

**Settings page** — `ThemeSettings` component registered as a `settingsComponent` for a new `theme` integration in the registry. Contains:

- **Theme selector** — horizontal chips showing all themes (presets + custom) with color dot previews. Active theme highlighted. "+ New Theme" button creates a copy of the current theme.
- **Color editor** — three grouped sections in a two-column compact grid:
  - Palette (8 slots)
  - Roles (success, warning, error, info)
  - Surfaces & Text (background, card, text tiers, borders)
  - Each row: color swatch (tappable) + label + hex value
  - Tapping a swatch opens a color picker (native `<input type="color">` is fine for v1)
- **Live preview** — real widget components rendered in a CSS-variable-scoped container at reduced scale. Dropdown to switch preview between Home Board view and individual widgets. Updates instantly as colors change.
- **Actions** — Save, Reset (revert to last saved), Delete (custom themes only)

### Live preview implementation

The preview renders actual dashboard components inside a wrapper div that has CSS variable overrides applied via inline styles. The wrapper uses `transform: scale()` and `transform-origin: top left` to fit the full dashboard into the preview area.

```tsx
<div style={{
  '--color-palette-1': editedColors.palette[0],
  '--color-palette-2': editedColors.palette[1],
  // ... all theme variables
  transform: 'scale(0.45)',
  transformOrigin: 'top left',
  width: '222%',  // 1/0.45 to maintain correct layout
}}>
  <HomeBoard />  {/* or whatever preview is selected */}
</div>
```

The preview dropdown options:
- Home Board (default) — shows all widgets at a glance
- Calendar — shows the monthly grid
- Individual widgets can be added later

For v1, a simplified static mini-dashboard mockup (like the mockup we designed) may be more practical than rendering real components, since real components need data and have loading states. The preview should show representative content that demonstrates how the colors apply.

### Theme application flow

1. App loads → `ThemeProvider` fetches config
2. If `theme.active` is set, find that theme in `theme.themes`
3. Apply each color as a CSS variable override on `document.documentElement.style`
4. When user switches themes in settings → apply immediately (live preview)
5. When user saves → persist to config via API
6. If no theme config exists → use CSS defaults from `variables.css` (Earth Tones)

## Settings Integration

Register as a `defineIntegration` with `hasBackend: false` and a custom `settingsComponent`:

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

This puts "Theme" in the settings sidebar alongside the other integrations.

## Deferred

- Dark mode preset (requires also theming the shadcn/Tailwind base variables)
- Theme import/export (JSON file)
- Rendering real live components in the preview (v1 uses a static mini mockup)
- Color picker with hue/saturation wheel (v1 uses native `<input type="color">`)
