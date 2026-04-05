import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'

const LAYOUTS = [
  { value: 'grid', label: 'Grid', description: 'Uniform 3-column grid — clean and predictable' },
  { value: 'magazine', label: 'Magazine', description: 'Mixed card sizes — hero card with adaptive bottom row' },
]

const WIDGET_IDS = [
  { id: 'sports', label: 'Sports' },
  { id: 'packages', label: 'Packages' },
  { id: 'countdowns', label: 'Countdowns' },
  { id: 'chores', label: 'Chores' },
  { id: 'lunch', label: 'Lunch Menu' },
  { id: 'on-this-day', label: 'On This Day' },
]

const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'compact', label: 'Compact' },
  { value: 'standard', label: 'Standard' },
  { value: 'expanded', label: 'Expanded' },
]

export function DashboardSettings() {
  const [layout, setLayout] = useState('grid')
  const [maxSizes, setMaxSizes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const config = await fetch('/api/config').then((r) => r.json()) as Record<string, string>
      setLayout(config['dashboard.layout'] ?? 'grid')
      const sizes: Record<string, string> = {}
      for (const { id } of WIDGET_IDS) {
        const val = config[`dashboard.widget.${id}.maxSize`]
        sizes[id] = val ?? 'auto'
      }
      setMaxSizes(sizes)
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    try {
      setError(null)
      await fetch(`/api/config/${encodeURIComponent('dashboard.layout')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: layout }),
      })

      // Save maxSize settings
      for (const { id } of WIDGET_IDS) {
        const key = `dashboard.widget.${id}.maxSize`
        const val = maxSizes[id]
        if (val === 'auto') {
          await fetch(`/api/config/${encodeURIComponent(key)}`, { method: 'DELETE' })
        } else {
          await fetch(`/api/config/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: val }),
          })
        }
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
        <label className="text-xs text-text-muted block mb-2">Home Layout</label>
        <div className="space-y-2">
          {LAYOUTS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                layout === opt.value
                  ? 'border-palette-1 bg-palette-1/5'
                  : 'border-border hover:bg-bg-card-hover'
              }`}
            >
              <input
                type="radio"
                name="layout"
                value={opt.value}
                checked={layout === opt.value}
                onChange={(e) => setLayout(e.target.value)}
                className="mt-0.5 accent-palette-1"
              />
              <div>
                <div className="text-sm font-medium text-text-primary">{opt.label}</div>
                <div className="text-xs text-text-muted">{opt.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {layout === 'magazine' && (
        <div>
          <label className="text-xs text-text-muted block mb-2">Widget Max Sizes</label>
          <div className="text-xs text-text-muted mb-3">
            Cap how large each widget can grow. "Auto" lets the layout engine decide.
          </div>
          <div className="space-y-2">
            {WIDGET_IDS.map(({ id, label }) => (
              <div key={id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                <span className="text-sm text-text-primary">{label}</span>
                <select
                  value={maxSizes[id] ?? 'auto'}
                  onChange={(e) => setMaxSizes((prev) => ({ ...prev, [id]: e.target.value }))}
                  className="bg-bg-card border border-border rounded px-2 py-1 text-sm text-text-primary"
                >
                  {SIZE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}
