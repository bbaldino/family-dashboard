import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'
import { doorbellIntegration } from './config'

export function DoorbellSettings() {
  const [cameraUrl, setCameraUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  const [micStatus, setMicStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const config = (await fetch('/api/config').then((r) => r.json())) as Record<string, string>
      const defaults = doorbellIntegration.schema.parse({})
      setCameraUrl(config['doorbell.camera_url'] ?? defaults.camera_url ?? '')
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }

    navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then((result) => {
        setMicStatus(result.state)
        result.onchange = () => setMicStatus(result.state)
      })
      .catch(() => {})
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    await fetch('/api/config/doorbell.camera_url', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: cameraUrl }),
    })
    setStatus('Saved!')
    setTimeout(() => setStatus(null), 2000)
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

  if (loading) return <div className="text-text-muted text-sm">Loading...</div>

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <label className="text-xs text-text-muted block mb-1">Camera Page URL</label>
        <input
          type="text"
          value={cameraUrl}
          onChange={(e) => setCameraUrl(e.target.value)}
          placeholder="e.g. https://cast.baldino.me/webrtc-doorbell.html"
          className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
      </div>

      <div className="bg-bg-card rounded-[var(--radius-card)] p-4 border border-border">
        <div className="text-sm font-medium text-text-primary mb-2">Microphone Permission</div>
        <div className="text-xs text-text-muted mb-3">
          Required for two-way audio on the camera feed. The iframe needs the parent page to have microphone access granted.
        </div>
        <div className="flex items-center gap-3">
          {micStatus === 'granted' ? (
            <span className="text-sm text-success font-medium">Microphone access granted</span>
          ) : micStatus === 'denied' ? (
            <span className="text-sm text-error font-medium">Microphone access denied — check browser settings</span>
          ) : (
            <Button onClick={requestMicrophone}>Request Microphone Access</Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave}>Save</Button>
        {status && <span className="text-sm text-success">{status}</span>}
      </div>
    </div>
  )
}
