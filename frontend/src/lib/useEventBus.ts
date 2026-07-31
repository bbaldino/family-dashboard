import { useContext } from 'react'
import { EventBusContext } from './event-bus-context'

export function useEventBus() {
  const ctx = useContext(EventBusContext)
  if (!ctx) throw new Error('useEventBus must be used within EventBusProvider')
  return ctx
}
