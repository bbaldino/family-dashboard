import type { WidgetMeta } from '@/lib/widget-types'
import { useOnThisDay } from './useOnThisDay'

export function useOnThisDayWidgetMeta(): WidgetMeta {
  const { data } = useOnThisDay()
  const events = data?.events ?? []

  if (events.length === 0) {
    return { visible: true, sizePreference: { orientation: 'square', relativeSize: 'medium' }, priority: 0 }
  }

  return { visible: true, sizePreference: { orientation: 'square', relativeSize: 'medium' }, priority: 0 }
}
