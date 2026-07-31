import type { WidgetMeta } from '@/lib/widget-types'

export function useCalendarWidgetMeta(): WidgetMeta {
  return {
    visible: true,
    priority: 100,
    sizePreference: { orientation: 'vertical', relativeSize: 'large' },
    anchor: { column: 1, row: 1 },
  }
}
