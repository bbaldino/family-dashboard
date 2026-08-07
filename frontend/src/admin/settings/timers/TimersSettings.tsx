import { useState } from 'react'
import { useAllConfig, useSaveConfig } from '@/platform'
import { Button } from '@/ui/Button'
import { ALARM_SOUNDS, DEFAULT_ALARM_ID } from '@/integrations/timers'

/**
 * Prefilled once from the shared `/api/config` query, then left alone — same
 * split as `themes/grid/GridSettingsPanel.tsx`: this outer half tracks the
 * live query and re-renders on every poll; the inner form's lazy `useState`
 * initialisers read it once at mount and ignore every later value, so a poll
 * tick can't overwrite an in-progress edit.
 */
export function TimersSettings() {
  const { data, isPending } = useAllConfig()

  if (isPending) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  return <TimersSettingsForm config={data} />
}

function TimersSettingsForm({ config }: { config: Record<string, string> | undefined }) {
  const [serviceUrl, setServiceUrl] = useState(() => config?.['timers.service_url'] ?? '')
  const [selectedSound, setSelectedSound] = useState(
    () => config?.['timers.alarm_sound'] ?? DEFAULT_ALARM_ID,
  )
  const [error, setError] = useState<string | null>(config ? null : 'Failed to load settings')
  const [status, setStatus] = useState<string | null>(null)
  const saveConfig = useSaveConfig()

  const handleSave = async () => {
    try {
      setError(null)
      // One mutation for both keys, so the shared config query refetches once
      // for this Save rather than once per key.
      await saveConfig.mutateAsync([
        { key: 'timers.service_url', value: serviceUrl },
        { key: 'timers.alarm_sound', value: selectedSound },
      ])
      setStatus('Saved!')
      setTimeout(() => setStatus(null), 2000)
    } catch {
      setError('Failed to save settings')
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>}

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
