import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/ui/Button'

export function DoorbellSettings() {
  const [go2rtcUrl, setGo2rtcUrl] = useState('')
  const [streamName, setStreamName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [micStatus, setMicStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const config = (await fetch('/api/config').then((r) => r.json())) as Record<string, string>
      setGo2rtcUrl(config['doorbell.go2rtc_url'] ?? '')
      setStreamName(config['doorbell.stream_name'] ?? '')
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }

    // Check current microphone permission
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      setMicStatus(result.state)
      result.onchange = () => setMicStatus(result.state)
    } catch {
      // permissions API not available
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    try {
      setError(null)
      const saves = [
        ['doorbell.go2rtc_url', go2rtcUrl],
        ['doorbell.stream_name', streamName],
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

  const requestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Got permission — stop the stream immediately, we just needed the grant
      stream.getTracks().forEach((t) => t.stop())
      setMicStatus('granted')
    } catch {
      setMicStatus('denied')
    }
  }

  if (loading) {
    return <div className="text-text-muted text-sm">Loading...</div>
  }

  return (
    <div className="space-y-6 max-w-md">
      {error && (
        <div className="bg-error/10 text-error rounded-lg p-3 text-sm">{error}</div>
      )}

      <div>
        <label className="text-xs text-text-muted block mb-1">go2rtc URL</label>
        <input
          type="text"
          value={go2rtcUrl}
          onChange={(e) => setGo2rtcUrl(e.target.value)}
          placeholder="e.g. http://frigate:1984"
          className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
      </div>

      <div>
        <label className="text-xs text-text-muted block mb-1">Stream name</label>
        <input
          type="text"
          value={streamName}
          onChange={(e) => setStreamName(e.target.value)}
          placeholder="e.g. doorbell"
          className="w-full px-3 py-2 border border-border rounded-[var(--radius-button)] bg-bg-primary text-text-primary text-sm"
        />
      </div>

      {/* Microphone permission */}
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
