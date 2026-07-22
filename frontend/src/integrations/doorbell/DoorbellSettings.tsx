import { useState, useEffect, useCallback, useRef } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/ui/Button'
import { ALARM_SOUNDS, getAlarmById } from '@/integrations/timers/alarmSounds'
import { doorbellIntegration } from './config'

export function DoorbellSettings() {
  const defaults = doorbellIntegration.schema.parse({})
  const [cameraUrl, setCameraUrl] = useState('')
  const [pressSensor, setPressSensor] = useState('')
  const [screensaverEntity, setScreensaverEntity] = useState('')
  const [autoDismissSeconds, setAutoDismissSeconds] = useState(
    String(defaults.auto_dismiss_seconds),
  )
  const [chimeEnabled, setChimeEnabled] = useState(defaults.chime_enabled)
  const [chimeSoundId, setChimeSoundId] = useState(defaults.chime_sound_id)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<{
    kind: 'ok' | 'error'
    text: string
  } | null>(null)
  const [micStatus, setMicStatus] = useState<
    'unknown' | 'granted' | 'denied' | 'prompt'
  >('unknown')
  const previewCtxRef = useRef<AudioContext | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const raw = (await fetch('/api/config').then((r) => r.json())) as Record<
        string,
        string
      >
      const g = (k: string, d: string) => raw[`doorbell.${k}`] ?? d
      setCameraUrl(g('camera_url', defaults.camera_url ?? ''))
      setPressSensor(g('press_sensor_entity', defaults.press_sensor_entity))
      setScreensaverEntity(g('screensaver_entity', defaults.screensaver_entity))
      setAutoDismissSeconds(
        g('auto_dismiss_seconds', String(defaults.auto_dismiss_seconds)),
      )
      setChimeEnabled(
        g('chime_enabled', String(defaults.chime_enabled)) === 'true',
      )
      setChimeSoundId(g('chime_sound_id', defaults.chime_sound_id))
    } catch {
      // fall through with defaults already in state
    } finally {
      setLoading(false)
    }

    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((result) => {
        setMicStatus(result.state)
        result.onchange = () => setMicStatus(result.state)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const putConfig = (key: string, value: string) =>
    fetch(`/api/config/doorbell.${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })

  const handleSave = async () => {
    try {
      await Promise.all([
        putConfig('camera_url', cameraUrl),
        putConfig('press_sensor_entity', pressSensor),
        putConfig('screensaver_entity', screensaverEntity),
        putConfig('auto_dismiss_seconds', autoDismissSeconds),
        putConfig('chime_enabled', String(chimeEnabled)),
        putConfig('chime_sound_id', chimeSoundId),
      ])
      setStatus({ kind: 'ok', text: 'Saved!' })
    } catch (err) {
      console.error('Failed to save doorbell settings', err)
      setStatus({ kind: 'error', text: 'Save failed' })
    } finally {
      setTimeout(() => setStatus(null), 2000)
    }
  }

  const requestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicStatus('granted')
    } catch {
      setMicStatus('denied')
    }
  }

  const previewChime = () => {
    previewCtxRef.current?.close().catch(() => {})
    previewCtxRef.current = getAlarmById(chimeSoundId).play()
  }

  useEffect(
    () => () => {
      previewCtxRef.current?.close().catch(() => {})
    },
    [],
  )

  if (loading) return <div className="text-text-muted text-sm">Loading...</div>

  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary mt-2 mb-1">
            Manual camera view
          </h3>
          <p className="text-xs text-text-muted mb-3">
            Used by the Cameras tab and the two-way audio iframe.
          </p>
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">
            Camera Page URL
          </label>
          <input
            type="text"
            value={cameraUrl}
            onChange={(e) => setCameraUrl(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
          />
        </div>

        <div className="bg-bg-card rounded-[var(--radius-card)] p-4 border border-border">
          <div className="text-sm font-medium text-text-primary mb-2">
            Microphone Permission
          </div>
          <div className="text-xs text-text-muted mb-3">
            Required for two-way audio on the camera feed. The iframe needs the parent page to have microphone access granted.
          </div>
          <div className="flex items-center gap-3">
            {micStatus === 'granted' ? (
              <span className="text-sm text-success font-medium">
                Microphone access granted
              </span>
            ) : micStatus === 'denied' ? (
              <span className="text-sm text-error font-medium">
                Microphone access denied — check browser settings
              </span>
            ) : (
              <Button onClick={requestMicrophone}>
                Request Microphone Access
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary mt-2 mb-1">
            Ring popup
          </h3>
          <p className="text-xs text-text-muted mb-3">
            Behavior when someone presses the doorbell button.
          </p>
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">
            Press Sensor Entity
          </label>
          <input
            type="text"
            value={pressSensor}
            onChange={(e) => setPressSensor(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
          />
          <div className="text-xs text-text-muted mt-1">
            HA binary_sensor that flips on when someone presses the button.
          </div>
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">
            Screensaver Entity (blank to disable skip)
          </label>
          <input
            type="text"
            value={screensaverEntity}
            onChange={(e) => setScreensaverEntity(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
          />
          <div className="text-xs text-text-muted mt-1">
            Popup is skipped while this entity is on.
          </div>
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">
            Auto-dismiss (seconds, 0 = never)
          </label>
          <input
            type="number"
            min={0}
            value={autoDismissSeconds}
            onChange={(e) => setAutoDismissSeconds(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
          />
        </div>

        <div className="bg-bg-card rounded-[var(--radius-card)] p-4 border border-border space-y-3">
          <label className="flex items-center gap-3 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={chimeEnabled}
              onChange={(e) => setChimeEnabled(e.target.checked)}
            />
            <span>Play chime when popup opens</span>
          </label>

          <div>
            <label className="text-xs text-text-muted block mb-1">
              Chime Sound
            </label>
            <div className="flex items-center gap-2">
              <select
                value={chimeSoundId}
                onChange={(e) => setChimeSoundId(e.target.value)}
                disabled={!chimeEnabled}
                className="flex-1 px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm disabled:opacity-50"
              >
                {ALARM_SOUNDS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={previewChime}
                disabled={!chimeEnabled}
                className="w-10 h-10 flex items-center justify-center rounded-[var(--radius-button)] bg-bg-card-hover text-text-primary disabled:opacity-50"
                aria-label="Preview chime"
              >
                <Play size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && (
          <span
            className={`text-sm ${status.kind === 'ok' ? 'text-success' : 'text-error'}`}
          >
            {status.text}
          </span>
        )}
      </div>
    </div>
  )
}
