import { useState, useCallback } from 'react'
import { WidgetCard } from '../../ui/WidgetCard'
import { useWebRtcStream } from './useWebRtcStream'
import { useIntegrationConfig } from '../use-integration-config'
import { doorbellIntegration } from './config'

export function DoorbellWidget() {
  const { config, isLoading } = useIntegrationConfig(doorbellIntegration)
  const [isLive, setIsLive] = useState(false)

  const go2rtcUrl = config?.go2rtc_url ?? 'http://frigate:1984'
  const streamName = config?.stream_name ?? 'doorbell'

  const { videoRef, isConnected, error, reconnect } = useWebRtcStream({
    go2rtcUrl,
    streamName,
    enabled: isLive,
  })

  const handleExpand = useCallback(() => setIsLive(true), [])
  const handleCollapse = useCallback(() => setIsLive(false), [])

  if (isLoading) return null

  const liveView = (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full rounded-lg bg-black"
      />
      <div className="absolute top-2 left-2 flex items-center gap-1.5">
        <div
          className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success' : 'bg-error animate-pulse'}`}
        />
        <span className="text-xs text-white/80 font-medium drop-shadow">
          Doorbell
        </span>
      </div>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <button
            onClick={reconnect}
            className="text-white text-sm underline"
          >
            Reconnect
          </button>
        </div>
      )}
    </div>
  )

  return (
    <WidgetCard
      title="Doorbell"
      category="info"
      detail={liveView}
      className="cursor-pointer"
      onExpand={handleExpand}
      onCollapse={handleCollapse}
    >
      <div className="flex flex-col items-center justify-center py-4 text-text-muted">
        <div className="w-10 h-10 rounded-full bg-bg-card-hover flex items-center justify-center mb-2 text-lg">
          {'\uD83D\uDCF7'}
        </div>
        <span className="text-xs">Tap for live view</span>
      </div>
    </WidgetCard>
  )
}
