import { createContext, type ReactNode } from 'react'

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

export const EventBusContext = createContext<EventBusContextValue | null>(null)
