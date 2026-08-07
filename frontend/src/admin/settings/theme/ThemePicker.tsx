import { useEffect, useState } from 'react'
import { getAllThemes, getTheme } from '@/shell/ThemeRegistry'
import type { ThemeSettings } from '@/shell/types'

const CONFIG_KEY = 'theme.presentation'
const DEFAULT_THEME_ID = 'grid'

/** Renders the selected theme's settings via its own `Component`. Every
 *  theme that declares `settings` supplies one — there is no generic
 *  fallback (see `docs/superpowers/specs/2026-08-05-theme-settings.md`). */
function ThemeSettingsSection({ settings }: { settings: ThemeSettings }) {
  const Component = settings.Component
  return (
    <div className="mt-6">
      <Component />
    </div>
  )
}

export function ThemePicker() {
  const [selected, setSelected] = useState<string>(DEFAULT_THEME_ID)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const themes = getAllThemes()
  const selectedTheme = getTheme(selected)

  useEffect(() => {
    let cancelled = false
    fetch('/api/config')
      .then((r) => r.json())
      .then((config: Record<string, string>) => {
        if (!cancelled) setSelected(config[CONFIG_KEY] ?? DEFAULT_THEME_ID)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const choose = async (id: string) => {
    const previous = selected
    setSelected(id)
    setSaving(true)
    setError(false)
    try {
      const response = await fetch(`/api/config/${CONFIG_KEY}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: id }),
      })
      if (!response.ok) throw new Error(`PUT ${CONFIG_KEY} failed: ${response.status}`)
    } catch {
      // The radio was optimistically selected before the request settled —
      // roll it back so the UI doesn't claim a save that never happened.
      setSelected(previous)
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mb-8">
      <h3 className="text-sm font-bold text-text-primary mb-1">Presentation</h3>
      <p className="text-xs text-text-secondary mb-3">
        Which layout the dashboard renders. The dashboard picks the change up within a minute — no
        reload needed.
      </p>
      <div className="flex flex-col gap-2">
        {themes.map((theme) => (
          <label key={theme.id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="presentation"
              value={theme.id}
              checked={selected === theme.id}
              onChange={() => choose(theme.id)}
            />
            <span className="text-sm text-text-primary">{theme.name}</span>
          </label>
        ))}
      </div>
      {saving && <p className="text-xs text-text-secondary mt-2">Saving…</p>}
      {error && <p className="text-xs text-error mt-2">Couldn’t save — please try again.</p>}
      {selectedTheme?.settings && <ThemeSettingsSection settings={selectedTheme.settings} />}
    </div>
  )
}
