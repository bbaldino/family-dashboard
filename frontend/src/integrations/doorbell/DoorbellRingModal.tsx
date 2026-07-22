import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useWebRtcStream } from './useWebRtcStream'

interface DoorbellRingModalProps {
  isOpen: boolean
  onClose: () => void
}

export function DoorbellRingModal({ isOpen, onClose }: DoorbellRingModalProps) {
  const { videoRef, isConnected, error, reconnect } = useWebRtcStream({
    go2rtcUrl: 'http://frigate:1984',
    streamName: 'doorbell',
    enabled: isOpen,
  })
  const dismissBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const prevFocus = document.activeElement as HTMLElement | null
    dismissBtnRef.current?.focus()
    return () => {
      prevFocus?.focus?.()
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="doorbell-ring-title"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-12 h-12 flex items-center justify-center text-white/70 hover:text-white"
        aria-label="Close"
      >
        <X size={32} />
      </button>

      <div
        className="flex flex-col items-center gap-6 px-8 w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          id="doorbell-ring-title"
          className="text-white/80 text-lg font-semibold"
        >
          Someone at the door
        </div>

        <div className="relative w-full" style={{ maxHeight: '75vh' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-2xl shadow-2xl bg-black"
            style={{ maxHeight: '75vh' }}
          />
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected ? 'bg-success' : 'bg-error animate-pulse'
              }`}
            />
            <span className="text-sm text-white/80 font-medium drop-shadow">
              Doorbell
            </span>
          </div>
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-2xl">
              <button
                onClick={reconnect}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
              >
                Reconnect
              </button>
            </div>
          )}
        </div>

        <button
          ref={dismissBtnRef}
          onClick={onClose}
          className="px-6 py-3 bg-white text-black rounded-full text-base font-medium"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
