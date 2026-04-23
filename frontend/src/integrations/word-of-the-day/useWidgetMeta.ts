import type { WidgetMeta } from '@/lib/widget-types'

export function useWordOfTheDayWidgetMeta(): WidgetMeta {
  return { visible: true, sizePreference: { orientation: 'square', relativeSize: 'medium' }, priority: 0 }
}
