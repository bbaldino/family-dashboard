import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'
import { ALARM_SOUNDS, DEFAULT_ALARM_ID } from './alarmSounds'

export function TimersSettings() {
  const [serviceUrl, setServiceUrl] = useState('')
  const [selectedSound, setSelectedSound] = useState(DEFAULT_ALARM_ID)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const config = (await fetch('/api/config').then((r) => r.json())) as Record<string, string>
      setServiceUrl(config['timers.service_url'] ?? '')
      setSelectedSound(config['timers.alarm_sound'] ?? DEFAULT_ALARM_ID)
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
      const saves = [
        ['timers.service_url', serviceUrl],
        ['timers.alarm_sound', selectedSound],
      ]
      for (const [key, value] of saves) {
        await fetch(`/api/config/${encodeURIComponent(key)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
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

      {/* Service URL */}
      <div>
        <label className="text-xs text-text-muted block mb-1">Timer Service URL</label>
        <input
          type="text"
          value={serviceUrl}
          onChange={(e) => setServiceUrl(e.target.value)}
          placeholder="e.g. http://192.168.1.21:3380/timers"
          className="w-full max-w-md px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
      </div>

      {/* Alarm sound picker */}
      <div>
        <label className="text-xs text-text-muted block mb-2">Alarm Sound</label>
        <div className="space-y-2 max-w-md">
          {ALARM_SOUNDS.map((sound) => (
            <div
              key={sound.id}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                selectedSound === sound.id
                  ? 'bg-palette-1/10 border border-palette-1/30'
                  : 'hover:bg-bg-card-hover border border-transparent'
              }`}
              onClick={() => setSelectedSound(sound.id)}
            >
              <input
                type="radio"
                name="alarm-sound"
                checked={selectedSound === sound.id}
                onChange={() => setSelectedSound(sound.id)}
                className="w-4 h-4 accent-palette-1"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-text-primary">{sound.name}</div>
                <div className="text-xs text-text-muted">{sound.description}</div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  sound.play()
                }}
                className="px-3 py-1.5 rounded-[var(--radius-button)] text-[12px] font-medium bg-bg-card-hover text-text-secondary hover:text-text-primary transition-colors"
              >
                Preview
              </button>
            </div>
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
