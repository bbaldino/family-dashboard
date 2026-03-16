import { useState } from 'react'
import { Button } from '@/ui/Button'
import { lunchMenuApi, type LunchDay } from '@/lib/dashboard-api'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const

function getMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  return monday.toISOString().slice(0, 10)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function LunchMenuAdmin() {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [weekOf, setWeekOf] = useState<string | null>(null)
  const [days, setDays] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    for (const day of WEEKDAYS) {
      init[day] = ['']
    }
    return init
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  async function handleLoad() {
    const monday = getMonday(selectedDate)
    setWeekOf(monday)
    setLoading(true)
    setFeedback(null)
    try {
      const menu = await lunchMenuApi.get(monday)
      const loaded: Record<string, string[]> = {}
      for (const day of WEEKDAYS) {
        const found = menu.days.find((d) => d.day.toLowerCase() === day.toLowerCase())
        loaded[day] = found && found.items.length > 0 ? [...found.items] : ['']
      }
      setDays(loaded)
      setFeedback({ type: 'success', message: `Loaded menu for week of ${monday}` })
    } catch (err) {
      // No existing menu — start fresh
      const fresh: Record<string, string[]> = {}
      for (const day of WEEKDAYS) {
        fresh[day] = ['']
      }
      setDays(fresh)
      const msg = err instanceof Error ? err.message : 'No existing menu found'
      setFeedback({
        type: 'success',
        message: `${msg} — starting fresh for week of ${monday}`,
      })
    } finally {
      setLoading(false)
    }
  }

  function updateItem(day: string, index: number, value: string) {
    setDays((prev) => {
      const items = [...prev[day]]
      items[index] = value
      return { ...prev, [day]: items }
    })
  }

  function addItem(day: string) {
    setDays((prev) => ({
      ...prev,
      [day]: [...prev[day], ''],
    }))
  }

  function removeItem(day: string, index: number) {
    setDays((prev) => {
      const items = prev[day].filter((_, i) => i !== index)
      return { ...prev, [day]: items.length > 0 ? items : [''] }
    })
  }

  async function handleSave() {
    if (!weekOf) return
    setSaving(true)
    setFeedback(null)
    try {
      const payload: LunchDay[] = WEEKDAYS.map((day) => ({
        day: day.toLowerCase(),
        items: days[day].filter((item) => item.trim() !== ''),
      }))
      await lunchMenuApi.upsert(weekOf, { days: payload })
      setFeedback({ type: 'success', message: 'Menu saved successfully!' })
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save menu',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-text-primary">Lunch Menu</h2>

      {feedback && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-green-900/30 border border-green-700 text-green-300'
              : 'bg-red-900/30 border border-red-700 text-red-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Week selector */}
      <div className="bg-bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <label className="text-sm text-text-secondary shrink-0">Select a date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-calendar"
        />
        <Button size="sm" variant="secondary" onClick={handleLoad} disabled={loading}>
          {loading ? 'Loading...' : 'Load Week'}
        </Button>
        {weekOf && (
          <span className="text-sm text-text-secondary">Week of {weekOf}</span>
        )}
      </div>

      {/* Day sections */}
      {weekOf && (
        <>
          <div className="space-y-4">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="bg-bg-card border border-border rounded-lg p-4 space-y-2"
              >
                <h3 className="font-medium text-text-primary">{day}</h3>
                {days[day].map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Menu item"
                      value={item}
                      onChange={(e) => updateItem(day, idx, e.target.value)}
                      className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-calendar"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(day, idx)}
                      className="text-text-secondary hover:text-red-400 text-sm px-2 py-1 transition-colors"
                      aria-label="Remove item"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => addItem(day)}>
                  + Add item
                </Button>
              </div>
            ))}
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Menu'}
          </Button>
        </>
      )}
    </div>
  )
}
