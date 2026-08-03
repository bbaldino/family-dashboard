import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface DoorbellRingModalProps {
  isOpen: boolean
  cameraUrl: string | null
  onClose: () => void
}

export function DoorbellRingModal({ isOpen, cameraUrl, onClose }: DoorbellRingModalProps) {
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
        <div id="doorbell-ring-title" className="text-white/80 text-lg font-semibold">
          Someone at the door
        </div>

        <div className="w-full" style={{ height: '75vh' }}>
          {cameraUrl ? (
            <iframe
              src={cameraUrl}
              className="w-full h-full rounded-2xl shadow-2xl border-0 bg-black"
              allow="autoplay; camera; microphone"
            />
          ) : (
            <div className="w-full h-full rounded-2xl shadow-2xl bg-black flex items-center justify-center text-white/60 text-sm">
              Configure camera URL in Settings → Doorbell Camera
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
