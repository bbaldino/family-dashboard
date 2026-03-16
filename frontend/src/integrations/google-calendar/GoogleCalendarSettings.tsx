import { useState, useEffect, useCallback } from 'react'
import { googleCalendarIntegration } from './config'

interface CalendarListEntry {
  id: string
  summary: string
  primary?: boolean
}

export function GoogleCalendarSettings() {
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [redirectUri, setRedirectUri] = useState('')
  const [calendarIds, setCalendarIds] = useState<string[]>([])
  const [calendars, setCalendars] = useState<CalendarListEntry[]>([])
  const [calendarsLoading, setCalendarsLoading] = useState(false)
  const [calendarsError, setCalendarsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  // Load existing config
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((allConfig: Record<string, string>) => {
        const prefix = 'google-calendar.'
        setClientId(allConfig[prefix + 'client_id'] ?? '')
        setClientSecret(allConfig[prefix + 'client_secret'] ?? '')
        setRedirectUri(allConfig[prefix + 'redirect_uri'] ?? '')
        const ids = allConfig[prefix + 'calendar_ids']
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
      const entries: Record<string, string> = {
        'google-calendar.client_id': clientId,
        'google-calendar.client_secret': clientSecret,
        'google-calendar.redirect_uri': redirectUri,
        'google-calendar.calendar_ids': JSON.stringify(calendarIds),
      }
      for (const [key, value] of Object.entries(entries)) {
        await fetch(`/api/config/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
      }
      setStatus('Saved!')
    } catch {
      setStatus('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* OAuth Credentials */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">
          Google Client ID
        </label>
        <input
          type="password"
          className="w-full px-3 py-2 bg-surface border border-border rounded text-text-primary text-sm"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">
          Google Client Secret
        </label>
        <input
          type="password"
          className="w-full px-3 py-2 bg-surface border border-border rounded text-text-primary text-sm"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">
          Redirect URI
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 bg-surface border border-border rounded text-text-primary text-sm"
          value={redirectUri}
          onChange={(e) => setRedirectUri(e.target.value)}
        />
      </div>

      {/* Calendar Picker */}
      <div className="border-t border-border pt-4">
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
