import type { WidgetMeta } from '@/lib/widget-types'

export function useOnThisDayWidgetMeta(): WidgetMeta {
  return { visible: true, preferredSize: 'standard', priority: 0 }
}
