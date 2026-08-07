import { useState } from 'react'
import { useAllConfig, useSaveConfig } from '@/platform'
import { useCalendarList, readStoredCalendarIds } from '@/providers/google-calendar'

/**
 * Connects the Google account and picks which calendars the household
 * calendar shows — one screen because that is one job to a person, even
 * though it now spans two things: `useCalendarList` is the *provider's*
 * (the connection and what it can answer), while the saved selection is the
 * `calendar` integration's policy and is written to `calendar.calendar_ids`.
 * Admin may touch config across integrations, so this crosses no boundary.
 *
 * Prefilled once from the shared `/api/config` query, then left alone — same
 * split as `themes/grid/GridSettingsPanel.tsx`: this outer half tracks the
 * live query and re-renders on every poll; the inner form's lazy `useState`
 * initialiser reads it once at mount and ignores every later value, so a poll
 * tick can't overwrite an in-progress edit.
 */
export function GoogleCalendarSettings() {
  const { data, isPending } = useAllConfig()

  if (isPending) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  return <GoogleCalendarSettingsForm config={data} />
}

function GoogleCalendarSettingsForm({ config }: { config: Record<string, string> | undefined }) {
  const [calendarIds, setCalendarIds] = useState<string[]>(() =>
    readStoredCalendarIds(config?.['calendar.calendar_ids']),
  )
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const configSaver = useSaveConfig()

  const {
    data: calendars = [],
    isFetching: calendarsLoading,
    error: calendarsQueryError,
    refetch: fetchCalendars,
  } = useCalendarList()
  const calendarsError = calendarsQueryError
    ? calendarsQueryError instanceof Error
      ? calendarsQueryError.message
      : 'Failed to fetch calendars'
    : null

  const toggleCalendar = (id: string) => {
    setCalendarIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  const saveConfig = async () => {
    setSaving(true)
    setStatus(null)
    try {
      await configSaver.mutateAsync({
        key: 'calendar.calendar_ids',
        value: JSON.stringify(calendarIds),
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
            onClick={() => fetchCalendars()}
            disabled={calendarsLoading}
            className="text-xs px-2 py-1 bg-surface border border-border rounded text-text-primary hover:bg-border"
          >
            {calendarsLoading ? 'Loading...' : 'Fetch Calendars'}
          </button>
        </div>
        {calendarsError && <div className="text-xs text-red-400 mb-2">{calendarsError}</div>}
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
                {cal.primary && <span className="text-xs text-text-muted">(primary)</span>}
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
