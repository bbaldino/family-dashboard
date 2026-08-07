import { useState, useEffect } from 'react'
import { useAllConfig, useSaveConfig } from '@/platform'
import { useCalendarList } from '@/providers/google-calendar'
import { Button } from '@/ui/Button'

/**
 * Prefilled once from the shared `/api/config` query, then left alone — same
 * split as `themes/grid/GridSettingsPanel.tsx`: this outer half tracks the
 * live query and re-renders on every poll; the inner form's lazy `useState`
 * initialisers read it once at mount and ignore every later value, so a poll
 * tick can't overwrite an in-progress edit.
 */
export function CountdownsSettings() {
  const { data, isPending } = useAllConfig()

  if (isPending) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  return <CountdownsSettingsForm config={data} />
}

function CountdownsSettingsForm({ config }: { config: Record<string, string> | undefined }) {
  // Unrelated to /api/config — the Google Calendar list, fetched once on
  // mount, same as before, now via the provider's own `useCalendarList`
  // (the same hook the calendar picker in `GoogleCalendarSettings` uses)
  // instead of a hand-rolled `api.get`. `useCalendarList` defaults to
  // `enabled: false` so an admin page load doesn't spend a Google API call
  // on its own; this effect is what turns that into "fetch once on mount"
  // for this panel, mirroring the original loading/error shape exactly.
  const { data: calendars = [], refetch: fetchCalendars } = useCalendarList()
  const [calendarsLoading, setCalendarsLoading] = useState(true)
  const [selectedCalendarId, setSelectedCalendarId] = useState(
    () => config?.['countdowns.calendar_id'] ?? '',
  )
  const [horizonDays, setHorizonDays] = useState(() => config?.['countdowns.horizon_days'] ?? '90')
  const [error, setError] = useState<string | null>(config ? null : 'Failed to load settings')
  const [status, setStatus] = useState<string | null>(null)
  const saveConfig = useSaveConfig()

  useEffect(() => {
    let cancelled = false
    fetchCalendars()
      .then((result) => {
        if (!cancelled && result.error) setError('Failed to load settings')
      })
      .finally(() => {
        if (!cancelled) setCalendarsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fetchCalendars])

  const handleSave = async () => {
    try {
      setError(null)
      // One mutation for both keys, so the shared config query refetches once
      // for this Save rather than once per key.
      await saveConfig.mutateAsync([
        { key: 'countdowns.calendar_id', value: selectedCalendarId },
        { key: 'countdowns.horizon_days', value: horizonDays },
      ])
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError('Failed to save')
    }
  }

  if (calendarsLoading) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>}

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
                  {cal.primary && <span className="text-xs text-text-muted">Primary</span>}
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
