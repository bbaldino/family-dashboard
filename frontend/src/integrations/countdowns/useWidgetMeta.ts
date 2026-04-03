import type { WidgetMeta } from '@/lib/widget-types'
import { useCountdowns } from './useCountdowns'

export function useCountdownsWidgetMeta(): WidgetMeta {
  const { data } = useCountdowns()
  const items = data ?? []

  if (items.length === 0) {
    return { visible: false }
  }

  return { visible: true, preferredSize: 'standard', priority: 2 }
}
