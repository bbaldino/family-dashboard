import type { WidgetMeta } from '@/lib/widget-types'

export function useWordOfTheDayWidgetMeta(): WidgetMeta {
  return { visible: true, preferredSize: 'standard', priority: 0 }
}
