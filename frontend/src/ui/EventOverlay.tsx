import { useEffect } from 'react'
import { useEventBus } from '../lib/event-bus'

export function EventOverlay() {
  const { currentOverlay, dismissOverlay } = useEventBus()

  useEffect(() => {
    if (!currentOverlay?.autoDismissMs) return
    const timer = setTimeout(dismissOverlay, currentOverlay.autoDismissMs)
    return () => clearTimeout(timer)
  }, [currentOverlay, dismissOverlay])

  if (!currentOverlay) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-overlay animate-[fadeIn_200ms_ease-out]"
      onClick={dismissOverlay}
    >
      <div
        className="animate-[slideUp_300ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {currentOverlay.content}
      </div>
    </div>
  )
}
