import { useEffect, useState } from 'react'
import { getAllThemes, getTheme } from '@/shell/ThemeRegistry'
import type { ThemeSettings } from '@/shell/types'
import { Button } from '@/ui/Button'

const CONFIG_KEY = 'theme.presentation'
const DEFAULT_THEME_ID = 'grid'

/** Renders a theme's settings: its own `Component` if it declares one,
 *  otherwise a generic form driven by its schema's `fields`. */
function ThemeSettingsSection({ settings, themeId }: { settings: ThemeSettings; themeId: string }) {
  if (settings.Component) {
    const Component = settings.Component
    return (
      <div className="mt-6">
        <Component />
      </div>
    )
  }
  return <GenericThemeSettingsForm settings={settings} themeId={themeId} />
}

function GenericThemeSettingsForm({
  settings,
  themeId,
}: {
  settings: ThemeSettings
  themeId: string
}) {
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const prefix = `theme.${themeId}.`

  useEffect(() => {
    let cancelled = false
    fetch('/api/config')
      .then((r) => r.json())
      .then((config: Record<string, string>) => {
        if (!cancelled) setLocalConfig(config)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [themeId])

  const handleChange = (key: string, value: string) => {
    setLocalConfig((prev) => ({ ...prev, [`${prefix}${key}`]: value }))
  }

  const handleSave = async () => {
    try {
      setError(false)
      for (const key of Object.keys(settings.fields)) {
        const fullKey = `${prefix}${key}`
        await fetch(`/api/config/${encodeURIComponent(fullKey)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: localConfig[fullKey] ?? '' }),
        })
      }
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError(true)
    }
  }

  return (
    <div className="mt-6 space-y-3">
      {(Object.entries(settings.fields) as [string, { label: string; description?: string }][]).map(
        ([key, meta]) => {
          const fullKey = `${prefix}${key}`
          return (
            <div key={key}>
              <label className="text-xs text-text-muted block mb-1">{meta.label}</label>
              <input
                type="text"
                value={localConfig[fullKey] ?? ''}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={meta.description}
                className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
              />
            </div>
          )
        },
      )}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
        {error && <span className="text-sm text-error">Couldn’t save — please try again.</span>}
      </div>
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
        Which layout the dashboard renders. Takes effect on the next reload.
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
      {selectedTheme?.settings && (
        <ThemeSettingsSection settings={selectedTheme.settings} themeId={selectedTheme.id} />
      )}
    </div>
  )
}
