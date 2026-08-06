import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'
import { gridSettingsFields, gridSettingsSchema } from './settings-declaration'

const WIDGETS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'sports', label: 'Sports' },
  { id: 'packages', label: 'Packages' },
  { id: 'countdowns', label: 'Coming Up' },
  { id: 'chores', label: 'Chores' },
  { id: 'lunch', label: 'Lunch Menu' },
  { id: 'on-this-day', label: 'On This Day' },
  { id: 'word-of-the-day', label: 'Word of the Day' },
]

/** The same defaults `HomeBoard` falls back to, read off the schema rather
 *  than copied as literals — the whole point of a shared declaration is
 *  that the form and the renderer can't drift apart on what "default"
 *  means. The number inputs' `min`/`max` are read off the same schema below,
 *  for the same reason: a bound the input doesn't enforce is exactly what
 *  let the old `DashboardSettings` form accept a value (like 30) that
 *  single-key parsing then silently rejected. */
const DEFAULTS = gridSettingsSchema.parse({})

const COLUMNS_JSON_SCHEMA = gridSettingsSchema.shape.columns.toJSONSchema()
const ROWS_JSON_SCHEMA = gridSettingsSchema.shape.rows.toJSONSchema()

export function GridSettingsPanel() {
  const [columns, setColumns] = useState(String(DEFAULTS.columns))
  const [rows, setRows] = useState(String(DEFAULTS.rows))
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const config = (await fetch('/api/config').then((r) => r.json())) as Record<string, string>
      setColumns(config['theme.grid.columns'] ?? String(DEFAULTS.columns))
      setRows(config['theme.grid.rows'] ?? String(DEFAULTS.rows))
      const hiddenStr = config['theme.grid.hidden'] ?? DEFAULTS.hidden
      setHidden(
        new Set(
          hiddenStr
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      )
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleWidget = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSave = async () => {
    try {
      setError(null)
      await fetch(`/api/config/${encodeURIComponent('theme.grid.columns')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: columns }),
      })
      await fetch(`/api/config/${encodeURIComponent('theme.grid.rows')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: rows }),
      })
      const hiddenStr = Array.from(hidden).join(',')
      if (hiddenStr) {
        await fetch(`/api/config/${encodeURIComponent('theme.grid.hidden')}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: hiddenStr }),
        })
      } else {
        await fetch(`/api/config/${encodeURIComponent('theme.grid.hidden')}`, {
          method: 'DELETE',
        })
      }
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError('Failed to save settings')
    }
  }

  if (loading) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {error && <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>}

      <div>
        <label className="text-xs text-text-muted block mb-2">
          {gridSettingsFields.columns.label}
        </label>
        <input
          type="number"
          min={COLUMNS_JSON_SCHEMA.minimum}
          max={COLUMNS_JSON_SCHEMA.maximum}
          value={columns}
          onChange={(e) => setColumns(e.target.value)}
          className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
        <div className="text-xs text-text-muted mt-1">
          Number of columns in the widget grid (default: {DEFAULTS.columns})
        </div>
      </div>

      <div>
        <label className="text-xs text-text-muted block mb-2">
          {gridSettingsFields.rows.label}
        </label>
        <input
          type="number"
          min={ROWS_JSON_SCHEMA.minimum}
          max={ROWS_JSON_SCHEMA.maximum}
          value={rows}
          onChange={(e) => setRows(e.target.value)}
          className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
        <div className="text-xs text-text-muted mt-1">
          Number of rows in the widget grid (default: {DEFAULTS.rows})
        </div>
      </div>

      <div>
        <label className="text-xs text-text-muted block mb-2">
          {gridSettingsFields.hidden.label}
        </label>
        <div className="space-y-2">
          {WIDGETS.map((w) => (
            <label key={w.id} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!hidden.has(w.id)}
                onChange={() => toggleWidget(w.id)}
                className="w-5 h-5 rounded accent-palette-1"
              />
              <span className="text-sm text-text-primary">{w.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}
