import { useState, useEffect, useRef } from 'react'
import { Button } from '@/ui/Button'
import { ThemePreview } from './ThemePreview'
import { useTheme } from './useTheme'
import type { Theme, ThemeColors } from './types'

function ColorSwatch({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [hexInput, setHexInput] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setHexInput(value) }, [value])

  const handleSubmit = () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
      onChange(hexInput.toLowerCase())
    }
    setEditing(false)
  }

  return (
    <div className="relative flex flex-col items-center gap-0.5">
      <div
        className="w-10 h-10 rounded-lg border border-border cursor-pointer hover:scale-110 transition-transform"
        style={{ background: value }}
        onClick={() => {
          setEditing(true)
          setHexInput(value)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
      />
      <span className="text-[8px] text-text-muted text-center leading-tight w-12 truncate">
        {label}
      </span>
      {editing && (
        <div
          className="absolute top-12 left-1/2 -translate-x-1/2 z-50 bg-bg-card rounded-lg shadow-lg border border-border p-2 flex flex-col gap-2 min-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded border border-border flex-shrink-0" style={{ background: hexInput }} />
            <input
              ref={inputRef}
              type="text"
              value={hexInput}
              onChange={(e) => setHexInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
              className="w-full px-2 py-1 text-[12px] font-mono border border-border rounded bg-bg-primary text-text-primary"
              placeholder="#000000"
            />
          </div>
          <input
            type="color"
            value={hexInput}
            onChange={(e) => {
              setHexInput(e.target.value)
              onChange(e.target.value)
            }}
            className="w-full h-8 cursor-pointer rounded"
          />
          <div className="flex gap-1">
            <button
              onClick={handleSubmit}
              className="flex-1 px-2 py-1 text-[11px] font-medium bg-palette-1 text-white rounded"
            >
              Apply
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 px-2 py-1 text-[11px] font-medium bg-bg-card-hover text-text-secondary rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

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

  useEffect(() => {
    setEditingTheme(activeTheme)
    setEditedColors(deepClone(activeTheme.colors))
  }, [activeTheme])

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
    if (editingTheme.builtin) return

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
    <div className="h-full flex flex-col gap-2">
      {/* Theme selector */}
      <div className="flex flex-wrap gap-2 flex-shrink-0">
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

      {/* Color editor — horizontal rows per section */}
      <div className="space-y-2 flex-shrink-0">
        {COLOR_SECTIONS.map((section) => (
          <div key={section.label} className="flex items-start gap-3">
            <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wide w-20 flex-shrink-0 pt-1.5">
              {section.label}
            </div>
            <div className="flex flex-wrap gap-2">
              {section.items.map((item) => {
                const value = item.get(editedColors)
                return (
                  <ColorSwatch
                    key={item.key}
                    value={value}
                    label={item.label.replace('Palette ', 'P').replace('Text ', '').replace('Border ', 'Bdr ')}
                    onChange={(v) => handleColorChange(item.key, v)}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
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

      {/* Preview — fills ALL remaining vertical space */}
      <div className="flex-1 min-h-0">
        <ThemePreview colors={editedColors} />
      </div>
    </div>
  )
}
