import type { WidgetMeta } from '@/lib/widget-types'
import { useOnThisDay } from './useOnThisDay'

export function useOnThisDayWidgetMeta(): WidgetMeta {
  const { data } = useOnThisDay()
  const events = data?.events ?? []

  if (events.length === 0) {
    return { visible: true, preferredSize: 'standard', priority: 0 }
  }

  return { visible: true, preferredSize: 'standard', priority: 0 }
}
