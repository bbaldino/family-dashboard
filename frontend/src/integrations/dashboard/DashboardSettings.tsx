import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'

const WIDGETS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'sports', label: 'Sports' },
  { id: 'packages', label: 'Packages' },
  { id: 'countdowns', label: 'Coming Up' },
  { id: 'chores', label: 'Chores' },
  { id: 'lunch', label: 'Lunch Menu' },
  { id: 'on-this-day', label: 'On This Day' },
  { id: 'birthdays', label: 'Born Today' },
  { id: 'word-of-the-day', label: 'Word of the Day' },
]

export function DashboardSettings() {
  const [columns, setColumns] = useState('8')
  const [rows, setRows] = useState('6')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const config = await fetch('/api/config').then((r) => r.json()) as Record<string, string>
      setColumns(config['dashboard.columns'] ?? '8')
      setRows(config['dashboard.rows'] ?? '6')
      const hiddenStr = config['dashboard.hidden'] ?? ''
      setHidden(new Set(hiddenStr.split(',').map((s) => s.trim()).filter(Boolean)))
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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
      await fetch(`/api/config/${encodeURIComponent('dashboard.columns')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: columns }),
      })
      await fetch(`/api/config/${encodeURIComponent('dashboard.rows')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: rows }),
      })
      const hiddenStr = Array.from(hidden).join(',')
      if (hiddenStr) {
        await fetch(`/api/config/${encodeURIComponent('dashboard.hidden')}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: hiddenStr }),
        })
      } else {
        await fetch(`/api/config/${encodeURIComponent('dashboard.hidden')}`, {
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
      {error && (
        <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>
      )}

      <div>
        <label className="text-xs text-text-muted block mb-2">Grid Columns</label>
        <input
          type="number"
          min="2"
          max="12"
          value={columns}
          onChange={(e) => setColumns(e.target.value)}
          className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
        <div className="text-xs text-text-muted mt-1">Number of columns in the widget grid (default: 8)</div>
      </div>

      <div>
        <label className="text-xs text-text-muted block mb-2">Grid Rows</label>
        <input
          type="number"
          min="2"
          max="8"
          value={rows}
          onChange={(e) => setRows(e.target.value)}
          className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
        <div className="text-xs text-text-muted mt-1">Number of rows in the widget grid (default: 6)</div>
      </div>

      <div>
        <label className="text-xs text-text-muted block mb-2">Visible Widgets</label>
        <div className="space-y-2">
          {WIDGETS.map((w) => (
            <label
              key={w.id}
              className="flex items-center gap-3 cursor-pointer"
            >
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
