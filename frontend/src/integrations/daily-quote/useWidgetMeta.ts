import type { WidgetMeta } from '@/lib/widget-types'

export function useDailyQuoteWidgetMeta(): WidgetMeta {
  return { visible: true, preferredSize: 'standard', priority: 0 }
}
