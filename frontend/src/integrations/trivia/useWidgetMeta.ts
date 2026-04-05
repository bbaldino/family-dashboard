import type { WidgetMeta } from '@/lib/widget-types'

export function useTriviaWidgetMeta(): WidgetMeta {
  return { visible: true, preferredSize: 'standard', priority: 0 }
}
