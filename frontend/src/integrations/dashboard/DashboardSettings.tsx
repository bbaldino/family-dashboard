import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'

const LAYOUTS = [
  { value: 'grid', label: 'Grid', description: 'Uniform 3-column grid — clean and predictable' },
  { value: 'magazine', label: 'Magazine', description: 'Mixed card sizes — hero card with adaptive bottom row' },
]

export function DashboardSettings() {
  const [layout, setLayout] = useState('grid')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const config = await fetch('/api/config').then((r) => r.json()) as Record<string, string>
      setLayout(config['dashboard.layout'] ?? 'grid')
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

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}
