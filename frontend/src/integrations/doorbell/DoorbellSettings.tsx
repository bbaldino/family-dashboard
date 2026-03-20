import { useState, useEffect } from 'react'
import { Button } from '@/ui/Button'

export function DoorbellSettings() {
  const [micStatus, setMicStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown')

  useEffect(() => {
    navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then((result) => {
        setMicStatus(result.state)
        result.onchange = () => setMicStatus(result.state)
      })
      .catch(() => {})
  }, [])

  const requestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      setMicStatus('granted')
    } catch {
      setMicStatus('denied')
    }
  }

  return (
    <div className="max-w-md">
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
    </div>
  )
}
