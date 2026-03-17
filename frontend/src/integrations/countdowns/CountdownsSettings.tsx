import { useState, useEffect, useCallback } from 'react'
import { googleCalendarIntegration } from '@/integrations/google-calendar/config'
import { Button } from '@/ui/Button'

interface CalendarListEntry {
  id: string
  summary: string
  primary?: boolean
}

export function CountdownsSettings() {
  const [calendars, setCalendars] = useState<CalendarListEntry[]>([])
  const [selectedCalendarId, setSelectedCalendarId] = useState('')
  const [horizonDays, setHorizonDays] = useState('90')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cals, config] = await Promise.all([
        googleCalendarIntegration.api!.get<CalendarListEntry[]>('/calendars').catch(() => []),
        fetch('/api/config').then((r) => r.json()) as Promise<Record<string, string>>,
      ])
      setCalendars(cals)
      setSelectedCalendarId(config['countdowns.calendar_id'] ?? '')
      setHorizonDays(config['countdowns.horizon_days'] ?? '90')
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    try {
      setError(null)
      await fetch('/api/config/countdowns.calendar_id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: selectedCalendarId }),
      })
      await fetch('/api/config/countdowns.horizon_days', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: horizonDays }),
      })
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError('Failed to save')
    }
  }

  if (loading) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>
      )}

      <div>
        <label className="text-xs text-text-muted block mb-1">Countdown Calendar</label>
        {calendars.length === 0 ? (
          <div className="text-sm text-text-muted">
            No calendars found. Make sure Google Calendar is connected.
          </div>
        ) : (
          <div className="space-y-1">
            {calendars.map((cal) => (
              <label
                key={cal.id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedCalendarId === cal.id
                    ? 'bg-info/10 border border-info/30'
                    : 'hover:bg-bg-card-hover border border-transparent'
                }`}
              >
                <input
                  type="radio"
                  name="countdown-calendar"
                  checked={selectedCalendarId === cal.id}
                  onChange={() => setSelectedCalendarId(cal.id)}
                  className="w-4 h-4 accent-info"
                />
                <div>
                  <div className="text-sm font-medium text-text-primary">{cal.summary}</div>
                  {cal.primary && (
                    <span className="text-xs text-text-muted">Primary</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="text-xs text-text-muted block mb-1">Days ahead</label>
        <input
          type="number"
          value={horizonDays}
          onChange={(e) => setHorizonDays(e.target.value)}
          className="w-24 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}
