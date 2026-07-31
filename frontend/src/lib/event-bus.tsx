import { useState, useCallback, type ReactNode } from 'react'
import { EventBusContext, type OverlayEvent } from './event-bus-context'

export function EventBusProvider({ children }: { children: ReactNode }) {
  const [currentOverlay, setCurrentOverlay] = useState<OverlayEvent | null>(null)

  const pushOverlay = useCallback((event: OverlayEvent) => {
    setCurrentOverlay((current) => {
      if (current && (current.priority ?? 0) > (event.priority ?? 0)) return current
      return event
    })
  }, [])

  const dismissOverlay = useCallback(() => setCurrentOverlay(null), [])

  return (
    <EventBusContext.Provider value={{ currentOverlay, pushOverlay, dismissOverlay }}>
      {children}
    </EventBusContext.Provider>
  )
}
