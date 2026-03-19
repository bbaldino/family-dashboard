# Theme Settings Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a theme settings page with preset selection, custom theme creation/editing, and a live mini-dashboard preview that updates instantly as colors change.

**Architecture:** Pure frontend. A `useTheme` hook loads themes from config and applies CSS variable overrides to `:root`. Built-in presets are hardcoded; custom themes are stored in the config table. A `ThemeSettings` component provides the editor UI with color swatches, a theme selector, and a static mini-dashboard preview scoped via CSS variable overrides on a wrapper div.

**Tech Stack:** React, TypeScript, Zod, TanStack Query (via config API)

**Spec:** `docs/superpowers/specs/2026-03-18-theme-settings-design.md`

---

## File Structure

### New files (`frontend/src/theme/`)

| File | Responsibility |
|------|---------------|
| `types.ts` | `Theme`, `ThemeColors` interfaces and preset definitions |
| `useTheme.ts` | Hook: load/save themes from config, apply CSS variables to `:root` |
| `ThemeSettings.tsx` | Settings page: theme selector, color editor, preview |
| `ThemePreview.tsx` | Static mini-dashboard preview with CSS variable scoping |
| `config.ts` | `defineIntegration` registration for theme settings |

### Modified files

| File | Change |
|------|--------|
| `frontend/src/integrations/registry.ts` | Add `themeIntegration` |
| `frontend/src/App.tsx` | Wrap app in theme application (call `useTheme` at top level) |

---

### Task 1: Theme types and presets

**Files:**
- Create: `frontend/src/theme/types.ts`

- [ ] **Step 1: Create types and preset definitions**

Create `frontend/src/theme/types.ts`:

```typescript
export interface ThemeColors {
  palette: string[] // exactly 8 hex colors
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

export interface Theme {
  id: string
  name: string
  builtin: boolean
  colors: ThemeColors
}

export const EARTH_TONES: Theme = {
  id: 'earth-tones',
  name: 'Earth Tones',
  builtin: true,
  colors: {
    palette: ['#c06830', '#4a8a4a', '#4a7a9a', '#9a7a30', '#8a5a9a', '#c04040', '#2a7a5a', '#aa6a7a'],
    roles: { success: '#4caf50', warning: '#c06830', error: '#e53935', info: '#4a7a9a' },
    surfaces: { background: '#f3efe9', card: '#ffffff', cardHover: '#f5f3ef' },
    text: { primary: '#2a2520', secondary: '#7a6a5a', muted: '#b0a89e', disabled: '#c0b8ae' },
    border: { default: '#e0dcd6', subtle: '#f0ece6' },
  },
}

export const OCEAN: Theme = {
  id: 'ocean',
  name: 'Ocean',
  builtin: true,
  colors: {
    palette: ['#2a7a9a', '#3a9a8a', '#5a8aba', '#6a8a5a', '#7a6a9a', '#c06a6a', '#2a8a6a', '#9a7a8a'],
    roles: { success: '#3a9a6a', warning: '#ca8a30', error: '#d04040', info: '#4a8aba' },
    surfaces: { background: '#eaf2f6', card: '#ffffff', cardHover: '#f0f5f8' },
    text: { primary: '#1a2a3a', secondary: '#4a6a7a', muted: '#8aa0ae', disabled: '#a8b8c4' },
    border: { default: '#d0dce4', subtle: '#e4ecf0' },
  },
}

export const BUILTIN_THEMES: Theme[] = [EARTH_TONES, OCEAN]

/** Map a ThemeColors object to CSS variable name → value pairs */
export function themeToVariables(colors: ThemeColors): Record<string, string> {
  const vars: Record<string, string> = {}

  // Palette
  colors.palette.forEach((c, i) => {
    vars[`--color-palette-${i + 1}`] = c
  })

  // Roles
  vars['--color-role-success'] = colors.roles.success
  vars['--color-role-warning'] = colors.roles.warning
  vars['--color-role-error'] = colors.roles.error
  vars['--color-role-info'] = colors.roles.info
  // Aliases
  vars['--color-success'] = colors.roles.success
  vars['--color-error'] = colors.roles.error
  vars['--color-info'] = colors.roles.info

  // Surfaces
  vars['--color-bg-primary'] = colors.surfaces.background
  vars['--color-bg-card'] = colors.surfaces.card
  vars['--color-bg-card-hover'] = colors.surfaces.cardHover

  // Text
  vars['--color-text-primary'] = colors.text.primary
  vars['--color-text-secondary'] = colors.text.secondary
  vars['--color-text-muted'] = colors.text.muted
  vars['--color-text-disabled'] = colors.text.disabled

  // Borders
  vars['--color-border-subtle'] = colors.border.subtle

  return vars
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/theme/types.ts
git commit -m "feat(theme-settings): add theme types, presets, and CSS variable mapper"
```

---

### Task 2: useTheme hook

**Files:**
- Create: `frontend/src/theme/useTheme.ts`

- [ ] **Step 1: Create the useTheme hook**

Create `frontend/src/theme/useTheme.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { BUILTIN_THEMES, EARTH_TONES, themeToVariables } from './types'
import type { Theme, ThemeColors } from './types'

function applyThemeToDocument(colors: ThemeColors) {
  const vars = themeToVariables(colors)
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value)
  }
}

function clearThemeFromDocument(colors: ThemeColors) {
  const vars = themeToVariables(colors)
  for (const key of Object.keys(vars)) {
    document.documentElement.style.removeProperty(key)
  }
}

export function useTheme() {
  const [activeId, setActiveId] = useState<string>('earth-tones')
  const [customThemes, setCustomThemes] = useState<Theme[]>([])
  const [loaded, setLoaded] = useState(false)

  const allThemes = [...BUILTIN_THEMES, ...customThemes]
  const activeTheme = allThemes.find((t) => t.id === activeId) ?? EARTH_TONES

  // Load from config on mount
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((config: Record<string, string>) => {
        if (config['theme.active']) {
          setActiveId(config['theme.active'])
        }
        if (config['theme.custom_themes']) {
          try {
            setCustomThemes(JSON.parse(config['theme.custom_themes']))
          } catch {
            // Invalid JSON, ignore
          }
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  // Apply active theme whenever it changes
  useEffect(() => {
    if (loaded) {
      applyThemeToDocument(activeTheme.colors)
    }
  }, [activeTheme, loaded])

  const setActiveTheme = useCallback(
    async (themeId: string) => {
      setActiveId(themeId)
      await fetch('/api/config/theme.active', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: themeId }),
      })
    },
    [],
  )

  const saveCustomThemes = useCallback(
    async (themes: Theme[]) => {
      setCustomThemes(themes)
      await fetch('/api/config/theme.custom_themes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(themes) }),
      })
    },
    [],
  )

  const applyPreview = useCallback((colors: ThemeColors) => {
    applyThemeToDocument(colors)
  }, [])

  const clearPreview = useCallback(() => {
    applyThemeToDocument(activeTheme.colors)
  }, [activeTheme])

  return {
    activeTheme,
    allThemes,
    customThemes,
    loaded,
    setActiveTheme,
    saveCustomThemes,
    applyPreview,
    clearPreview,
  }
}
```

- [ ] **Step 2: Wire useTheme into App.tsx**

In `frontend/src/App.tsx`, add a component that calls `useTheme()` at the top level to apply the theme on load. Add it inside `QueryClientProvider`:

```typescript
import { useTheme } from './theme/useTheme'

function ThemeApplicator() {
  useTheme()
  return null
}
```

Then render `<ThemeApplicator />` inside the `content` JSX, before `<AppRoutes />`.

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/theme/useTheme.ts frontend/src/App.tsx
git commit -m "feat(theme-settings): add useTheme hook and wire into App"
```

---

### Task 3: Theme preview component

**Files:**
- Create: `frontend/src/theme/ThemePreview.tsx`

- [ ] **Step 1: Create the static mini-dashboard preview**

Create `frontend/src/theme/ThemePreview.tsx`. This is a self-contained static mockup that uses CSS variables from a scoped wrapper, showing representative dashboard content:

```typescript
import { themeToVariables } from './types'
import type { ThemeColors } from './types'

interface ThemePreviewProps {
  colors: ThemeColors
}

export function ThemePreview({ colors }: ThemePreviewProps) {
  const vars = themeToVariables(colors)
  const style: Record<string, string> = { ...vars }

  return (
    <div style={style}>
      <div
        className="rounded-lg border overflow-hidden"
        style={{ background: 'var(--color-bg-primary)', borderColor: 'var(--color-border-subtle)' }}
      >
        {/* Mini hero */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ background: 'var(--color-bg-card)' }}
        >
          <span className="text-[16px] font-extralight" style={{ color: 'var(--color-text-primary)' }}>
            4:40 PM
          </span>
          <div className="w-px h-5" style={{ background: 'var(--color-border-subtle)' }} />
          <div>
            <div
              className="text-[7px] font-bold uppercase"
              style={{ color: 'var(--color-palette-1)' }}
            >
              Next Up
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px]" style={{ color: 'var(--color-text-primary)' }}>
                AA Practice
              </span>
              <span
                className="text-[8px] font-semibold"
                style={{ color: 'var(--color-palette-1)' }}
              >
                5:00 PM
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span className="text-[14px]">☀️</span>
            <span className="text-[14px] font-light" style={{ color: 'var(--color-text-primary)' }}>
              90°
            </span>
          </div>
        </div>

        {/* Mini widget grid */}
        <div className="grid grid-cols-4 gap-1 p-1.5">
          {/* Schedule */}
          <MiniWidget title="Schedule" color="var(--color-palette-1)" badge="14" rowSpan>
            <div className="space-y-0.5">
              <MiniEventRow time="11:30" name="Mileage Club" color="var(--color-palette-1)" />
              <MiniEventRow time="5:00" name="AA Practice" color="var(--color-palette-1)" />
              <MiniEventRow time="5:00" name="AAA Practice" color="var(--color-palette-1)" />
            </div>
          </MiniWidget>

          {/* Packages */}
          <MiniWidget title="Packages" color="var(--color-palette-5)" badge="1">
            <div className="flex items-center gap-1">
              <span className="text-[8px]">📦</span>
              <span className="text-[7px] truncate" style={{ color: 'var(--color-text-primary)' }}>
                Toothpaste
              </span>
            </div>
          </MiniWidget>

          {/* Coming Up */}
          <MiniWidget title="Coming Up" color="var(--color-palette-3)">
            <MiniCountdown name="Avila Beach" days="25d" color="var(--color-palette-3)" />
            <MiniCountdown name="Birthday" days="28d" color="var(--color-palette-3)" />
          </MiniWidget>

          {/* Sports */}
          <MiniWidget title="Sports" color="var(--color-palette-6)" badge="1 Live">
            <div className="text-center">
              <div className="text-[6px] uppercase font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                NBA
              </div>
              <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                23 - 36
              </div>
              <div>
                <span
                  className="text-[6px] font-bold uppercase"
                  style={{ color: 'var(--color-role-error)' }}
                >
                  ● Live
                </span>
              </div>
            </div>
          </MiniWidget>

          {/* Chores */}
          <MiniWidget title="Chores" color="var(--color-palette-2)" badge="2/4">
            <div className="text-[7px]" style={{ color: 'var(--color-text-primary)' }}>
              ✓ Make bed
            </div>
            <div className="text-[7px]" style={{ color: 'var(--color-text-primary)' }}>
              ○ Clean room
            </div>
          </MiniWidget>

          {/* Lunch */}
          <MiniWidget title="Lunch" color="var(--color-palette-4)">
            <div className="text-[7px]" style={{ color: 'var(--color-text-primary)' }}>
              • Hot Dog
            </div>
            <div className="text-[7px]" style={{ color: 'var(--color-text-primary)' }}>
              • Corn Dog
            </div>
          </MiniWidget>

          {/* Grocery */}
          <MiniWidget title="Grocery" color="var(--color-palette-5)">
            <div className="text-[7px]" style={{ color: 'var(--color-text-muted)' }}>
              No items
            </div>
          </MiniWidget>
        </div>

        {/* Mini tab bar */}
        <div
          className="flex justify-center gap-5 py-1.5"
          style={{ background: 'var(--color-bg-card)', borderTop: '1px solid var(--color-border-subtle)' }}
        >
          <MiniTab label="Home" active color="var(--color-palette-1)" textColor="var(--color-text-muted)" />
          <MiniTab label="Calendar" color="var(--color-palette-1)" textColor="var(--color-text-muted)" />
          <MiniTab label="Media" color="var(--color-palette-1)" textColor="var(--color-text-muted)" />
        </div>
      </div>
    </div>
  )
}

function MiniWidget({
  title, color, badge, rowSpan, children,
}: {
  title: string; color: string; badge?: string; rowSpan?: boolean; children: React.ReactNode
}) {
  return (
    <div
      className={`rounded-md p-1.5 ${rowSpan ? 'row-span-2' : ''}`}
      style={{ background: 'var(--color-bg-card)' }}
    >
      <div
        className="flex justify-between items-center pb-0.5 mb-1"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <span className="text-[7px] font-bold uppercase tracking-wide" style={{ color }}>
          {title}
        </span>
        {badge && (
          <span
            className="text-[6px] font-semibold px-1 rounded"
            style={{ background: `color-mix(in srgb, ${color} 10%, transparent)`, color }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function MiniEventRow({ time, name, color }: { time: string; name: string; color: string }) {
  return (
    <div className="flex gap-1 items-baseline">
      <span className="text-[7px] font-semibold min-w-[20px]" style={{ color }}>{time}</span>
      <span className="text-[7px] truncate" style={{ color: 'var(--color-text-primary)' }}>{name}</span>
    </div>
  )
}

function MiniCountdown({ name, days, color }: { name: string; days: string; color: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[7px]" style={{ color: 'var(--color-text-primary)' }}>{name}</span>
      <span className="text-[7px] font-semibold" style={{ color }}>{days}</span>
    </div>
  )
}

function MiniTab({ label, active, color, textColor }: { label: string; active?: boolean; color: string; textColor: string }) {
  return (
    <div
      className="text-center text-[7px]"
      style={{ color: active ? color : textColor, fontWeight: active ? 600 : 400 }}
    >
      {label}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/theme/ThemePreview.tsx
git commit -m "feat(theme-settings): add static mini-dashboard preview component"
```

---

### Task 4: ThemeSettings component

**Files:**
- Create: `frontend/src/theme/ThemeSettings.tsx`
- Create: `frontend/src/theme/config.ts`
- Modify: `frontend/src/integrations/registry.ts`

- [ ] **Step 1: Create ThemeSettings component**

Create `frontend/src/theme/ThemeSettings.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'
import { ThemePreview } from './ThemePreview'
import { useTheme } from './useTheme'
import { BUILTIN_THEMES } from './types'
import type { Theme, ThemeColors } from './types'

function generateId(): string {
  return 'custom-' + Date.now().toString(36)
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

const COLOR_SECTIONS: {
  label: string
  items: { key: string; label: string; get: (c: ThemeColors) => string; set: (c: ThemeColors, v: string) => void }[]
}[] = [
  {
    label: 'Palette',
    items: Array.from({ length: 8 }, (_, i) => ({
      key: `palette-${i + 1}`,
      label: `Palette ${i + 1}`,
      get: (c: ThemeColors) => c.palette[i],
      set: (c: ThemeColors, v: string) => { c.palette[i] = v },
    })),
  },
  {
    label: 'Roles',
    items: [
      { key: 'success', label: 'Success', get: (c) => c.roles.success, set: (c, v) => { c.roles.success = v } },
      { key: 'warning', label: 'Warning', get: (c) => c.roles.warning, set: (c, v) => { c.roles.warning = v } },
      { key: 'error', label: 'Error', get: (c) => c.roles.error, set: (c, v) => { c.roles.error = v } },
      { key: 'info', label: 'Info', get: (c) => c.roles.info, set: (c, v) => { c.roles.info = v } },
    ],
  },
  {
    label: 'Surfaces, Text & Borders',
    items: [
      { key: 'bg', label: 'Background', get: (c) => c.surfaces.background, set: (c, v) => { c.surfaces.background = v } },
      { key: 'card', label: 'Card', get: (c) => c.surfaces.card, set: (c, v) => { c.surfaces.card = v } },
      { key: 'text-primary', label: 'Text Primary', get: (c) => c.text.primary, set: (c, v) => { c.text.primary = v } },
      { key: 'text-secondary', label: 'Text Secondary', get: (c) => c.text.secondary, set: (c, v) => { c.text.secondary = v } },
      { key: 'text-muted', label: 'Text Muted', get: (c) => c.text.muted, set: (c, v) => { c.text.muted = v } },
      { key: 'text-disabled', label: 'Text Disabled', get: (c) => c.text.disabled, set: (c, v) => { c.text.disabled = v } },
      { key: 'border', label: 'Border', get: (c) => c.border.default, set: (c, v) => { c.border.default = v } },
      { key: 'border-subtle', label: 'Border Subtle', get: (c) => c.border.subtle, set: (c, v) => { c.border.subtle = v } },
    ],
  },
]

export function ThemeSettings() {
  const { activeTheme, allThemes, customThemes, setActiveTheme, saveCustomThemes, applyPreview, clearPreview } = useTheme()
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null)
  const [editedColors, setEditedColors] = useState<ThemeColors | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  // When active theme changes, start editing it
  useEffect(() => {
    setEditingTheme(activeTheme)
    setEditedColors(deepClone(activeTheme.colors))
  }, [activeTheme])

  // Apply preview whenever edited colors change
  useEffect(() => {
    if (editedColors) {
      applyPreview(editedColors)
    }
    return () => clearPreview()
  }, [editedColors, applyPreview, clearPreview])

  const handleColorChange = (key: string, value: string) => {
    if (!editedColors) return
    const newColors = deepClone(editedColors)
    for (const section of COLOR_SECTIONS) {
      const item = section.items.find((i) => i.key === key)
      if (item) {
        item.set(newColors, value)
        break
      }
    }
    setEditedColors(newColors)
  }

  const handleSelectTheme = (theme: Theme) => {
    setActiveTheme(theme.id)
    setEditingTheme(theme)
    setEditedColors(deepClone(theme.colors))
  }

  const handleNewTheme = () => {
    const source = editingTheme ?? activeTheme
    const newTheme: Theme = {
      id: generateId(),
      name: `${source.name} Copy`,
      builtin: false,
      colors: deepClone(source.colors),
    }
    const updated = [...customThemes, newTheme]
    saveCustomThemes(updated)
    setActiveTheme(newTheme.id)
  }

  const handleSave = async () => {
    if (!editingTheme || !editedColors) return
    if (editingTheme.builtin) return // can't save builtins

    const updated = customThemes.map((t) =>
      t.id === editingTheme.id ? { ...t, colors: deepClone(editedColors) } : t,
    )
    await saveCustomThemes(updated)
    setStatus('Saved!')
    setTimeout(() => setStatus(null), 2000)
  }

  const handleReset = () => {
    if (editingTheme) {
      setEditedColors(deepClone(editingTheme.colors))
    }
  }

  const handleDelete = async () => {
    if (!editingTheme || editingTheme.builtin) return
    const updated = customThemes.filter((t) => t.id !== editingTheme.id)
    await saveCustomThemes(updated)
    setActiveTheme('earth-tones')
  }

  if (!editedColors) return null

  return (
    <div className="flex gap-5">
      {/* Left: Editor */}
      <div className="flex-1 min-w-0">
        {/* Theme selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {allThemes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => handleSelectTheme(theme)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border-2 transition-colors ${
                activeTheme.id === theme.id
                  ? 'border-palette-1 bg-palette-1/10 text-palette-1'
                  : 'border-border text-text-secondary hover:border-text-muted'
              }`}
            >
              <div className="flex gap-1">
                {theme.colors.palette.slice(0, 3).map((c, i) => (
                  <div key={i} className="w-2 h-2 rounded-full" style={{ background: c }} />
                ))}
              </div>
              {theme.name}
            </button>
          ))}
          <button
            onClick={handleNewTheme}
            className="px-3 py-1.5 rounded-full text-[12px] font-medium border-2 border-dashed border-border text-text-muted hover:border-text-secondary"
          >
            + New Theme
          </button>
        </div>

        {/* Color editor sections */}
        {COLOR_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mt-4 mb-2">
              {section.label}
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              {section.items.map((item) => {
                const value = item.get(editedColors)
                return (
                  <div key={item.key} className="flex items-center gap-2 py-1.5 border-b border-border-subtle">
                    <label className="relative cursor-pointer">
                      <div
                        className="w-7 h-7 rounded-lg border border-border cursor-pointer hover:scale-110 transition-transform"
                        style={{ background: value }}
                      />
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => handleColorChange(item.key, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </label>
                    <span className="text-[12px] font-medium text-text-primary flex-1">{item.label}</span>
                    <span className="text-[10px] font-mono text-text-muted">{value}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t-2 border-border-subtle">
          {!editingTheme?.builtin && (
            <Button onClick={handleSave}>Save Theme</Button>
          )}
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-[var(--radius-button)] text-[13px] font-medium bg-bg-card-hover text-text-secondary"
          >
            Reset
          </button>
          {!editingTheme?.builtin && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 rounded-[var(--radius-button)] text-[13px] font-medium bg-bg-card-hover text-error"
            >
              Delete
            </button>
          )}
          {editingTheme?.builtin && (
            <span className="text-[11px] text-text-muted">Built-in theme — create a copy to customize</span>
          )}
          {status && <span className="text-[12px] text-success ml-auto">{status}</span>}
        </div>
      </div>

      {/* Right: Preview */}
      <div className="w-[350px] flex-shrink-0">
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-2">
          Live Preview
        </div>
        <ThemePreview colors={editedColors} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create integration config**

Create `frontend/src/theme/config.ts`:

```typescript
import { z } from 'zod'
import { defineIntegration } from '@/integrations/define-integration'
import { ThemeSettings } from './ThemeSettings'

export const themeIntegration = defineIntegration({
  id: 'theme',
  name: 'Theme',
  hasBackend: false,
  schema: z.object({}),
  fields: {},
  settingsComponent: ThemeSettings,
})
```

- [ ] **Step 3: Register in the integration registry**

In `frontend/src/integrations/registry.ts`, add:
```typescript
import { themeIntegration } from '@/theme/config'
```
Add `themeIntegration` to the `integrations` array.

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/theme/ThemeSettings.tsx frontend/src/theme/config.ts frontend/src/integrations/registry.ts
git commit -m "feat(theme-settings): add ThemeSettings editor with preview and integration config"
```

---

### Task 5: End-to-end verification

- [ ] **Step 1: Type check**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 2: Visual verification**

Start the frontend dev server and verify:
- Settings → Theme shows the editor
- Earth Tones and Ocean presets appear as chips
- Clicking Ocean switches the entire dashboard's colors
- Editing a color swatch updates the mini preview instantly
- "+ New Theme" creates a copy that can be saved
- Save persists; refresh keeps the theme
- Delete removes a custom theme
- Built-in themes show "create a copy to customize" hint

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "feat(theme-settings): complete theme settings page"
```
