import { useState, useEffect } from 'react'
import { doorbellIntegration } from '@/integrations/doorbell/config'

export function CamerasBoard() {
  const [cameraUrl, setCameraUrl] = useState<string | null>(null)

  useEffect(() => {
    const defaults = doorbellIntegration.schema.parse({})
    fetch('/api/config')
      .then((r) => r.json())
      .then((config: Record<string, string>) => {
        setCameraUrl(config['doorbell.camera_url'] || defaults.camera_url || null)
      })
      .catch(() => {
        setCameraUrl(defaults.camera_url || null)
      })
  }, [])

  if (!cameraUrl) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        Configure camera URL in Settings → Doorbell Camera
      </div>
    )
  }

  return (
    <div className="h-full">
      <iframe
        src={cameraUrl}
        className="w-full h-full border-0"
        allow="autoplay; camera; microphone"
      />
    </div>
  )
}
