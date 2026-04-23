import type { WidgetMeta } from '@/lib/widget-types'
import { useOnThisDay } from './useOnThisDay'

export function useBirthdaysWidgetMeta(): WidgetMeta {
  const { data } = useOnThisDay()
  const births = data?.births ?? []

  if (births.length === 0) {
    return { visible: false }
  }

  return { visible: true, priority: 0, sizePreference: { orientation: 'square', relativeSize: 'medium' } }
}
