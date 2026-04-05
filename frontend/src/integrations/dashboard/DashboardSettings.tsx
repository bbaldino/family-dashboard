import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'

export function DashboardSettings() {
  const [columns, setColumns] = useState('6')
  const [rows, setRows] = useState('4')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const config = await fetch('/api/config').then((r) => r.json()) as Record<string, string>
      setColumns(config['dashboard.columns'] ?? '6')
      setRows(config['dashboard.rows'] ?? '4')
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
        <div className="text-xs text-text-muted mt-1">Number of columns in the widget grid (default: 6)</div>
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
        <div className="text-xs text-text-muted mt-1">Number of rows in the widget grid (default: 4)</div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}
