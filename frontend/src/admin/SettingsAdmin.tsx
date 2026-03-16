import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'
import {
  configApi,
  googleCalendarApi,
  type CalendarListEntry,
} from '@/lib/dashboard-api'

export function SettingsAdmin() {
  const [calendars, setCalendars] = useState<CalendarListEntry[]>([])
  const [selectedCalendars, setSelectedCalendars] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [cals, config] = await Promise.all([
        googleCalendarApi.listCalendars().catch(() => [] as CalendarListEntry[]),
        configApi.getAll(),
      ])

      setCalendars(cals)

      const saved = config['google_calendar_ids']
      if (saved) {
        setSelectedCalendars(JSON.parse(saved))
      } else if (cals.length > 0) {
        // Default to primary calendar
        const primary = cals.find((c) => c.primary)
        setSelectedCalendars(primary ? [primary.id] : [cals[0].id])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggleCalendar = (id: string) => {
    setSelectedCalendars((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  const handleSave = async () => {
    try {
      await configApi.set(
        'google_calendar_ids',
        JSON.stringify(selectedCalendars),
      )
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  if (loading) {
    return <div className="text-text-muted">Loading settings...</div>
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-6">Settings</h2>

      {error && (
        <div className="bg-error/10 text-error rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Google Calendar Selection */}
      <div className="bg-bg-card rounded-[var(--radius-card)] p-4 border border-border mb-6">
        <h3 className="text-sm font-semibold text-text-secondary mb-1">
          Google Calendars
        </h3>
        <p className="text-xs text-text-muted mb-4">
          Select which calendars to show on the dashboard
        </p>

        {calendars.length === 0 ? (
          <div className="text-sm text-text-muted">
            No calendars found. Make sure Google Calendar is connected
            (visit <code className="bg-bg-primary px-1 rounded">/api/google/auth</code> to authenticate).
          </div>
        ) : (
          <div className="space-y-2">
            {calendars.map((cal) => (
              <label
                key={cal.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-bg-card-hover cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedCalendars.includes(cal.id)}
                  onChange={() => toggleCalendar(cal.id)}
                  className="w-5 h-5 rounded accent-calendar"
                />
                <div>
                  <div className="text-sm font-medium text-text-primary">
                    {cal.summary}
                  </div>
                  {cal.primary && (
                    <span className="text-xs text-text-muted">Primary</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save Settings</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}
