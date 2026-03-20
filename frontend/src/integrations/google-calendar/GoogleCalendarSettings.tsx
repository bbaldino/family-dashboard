import { useState, useEffect, useCallback } from 'react'
import { googleCalendarIntegration } from './config'

interface CalendarListEntry {
  id: string
  summary: string
  primary?: boolean
}

export function GoogleCalendarSettings() {
  const [calendarIds, setCalendarIds] = useState<string[]>([])
  const [calendars, setCalendars] = useState<CalendarListEntry[]>([])
  const [calendarsLoading, setCalendarsLoading] = useState(false)
  const [calendarsError, setCalendarsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((allConfig: Record<string, string>) => {
        const ids = allConfig['google-calendar.calendar_ids']
        if (ids) {
          try {
            setCalendarIds(JSON.parse(ids))
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {})
  }, [])

  const fetchCalendars = useCallback(async () => {
    setCalendarsLoading(true)
    setCalendarsError(null)
    try {
      const list = await googleCalendarIntegration.api.get<CalendarListEntry[]>('/calendars')
      setCalendars(list)
    } catch (e) {
      setCalendarsError(e instanceof Error ? e.message : 'Failed to fetch calendars')
    } finally {
      setCalendarsLoading(false)
    }
  }, [])

  const toggleCalendar = (id: string) => {
    setCalendarIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  const saveConfig = async () => {
    setSaving(true)
    setStatus(null)
    try {
      await fetch(`/api/config/${encodeURIComponent('google-calendar.calendar_ids')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: JSON.stringify(calendarIds) }),
      })
      setStatus('Saved!')
    } catch {
      setStatus('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-text-muted">
        OAuth credentials are configured in Settings → Google Cloud.
      </div>

      {/* Calendar Picker */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-medium text-text-secondary">Calendar Selection</span>
          <button
            onClick={fetchCalendars}
            disabled={calendarsLoading}
            className="text-xs px-2 py-1 bg-surface border border-border rounded text-text-primary hover:bg-border"
          >
            {calendarsLoading ? 'Loading...' : 'Fetch Calendars'}
          </button>
        </div>
        {calendarsError && (
          <div className="text-xs text-red-400 mb-2">{calendarsError}</div>
        )}
        {calendars.length > 0 && (
          <div className="space-y-1">
            {calendars.map((cal) => (
              <label key={cal.id} className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={calendarIds.includes(cal.id)}
                  onChange={() => toggleCalendar(cal.id)}
                />
                {cal.summary}
                {cal.primary && (
                  <span className="text-xs text-text-muted">(primary)</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={saveConfig}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {status && <span className="text-sm text-text-muted">{status}</span>}
      </div>
    </div>
  )
}
