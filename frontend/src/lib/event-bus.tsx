import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface OverlayEvent {
  id: string
  content: ReactNode
  autoDismissMs?: number
  priority?: number
}

export interface EventBusContextValue {
  currentOverlay: OverlayEvent | null
  pushOverlay: (event: OverlayEvent) => void
  dismissOverlay: () => void
}

const EventBusContext = createContext<EventBusContextValue | null>(null)

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

export function useEventBus() {
  const ctx = useContext(EventBusContext)
  if (!ctx) throw new Error('useEventBus must be used within EventBusProvider')
  return ctx
}
