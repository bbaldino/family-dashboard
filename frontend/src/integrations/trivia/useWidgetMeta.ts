import type { WidgetMeta } from '@/lib/widget-types'

export function useTriviaWidgetMeta(): WidgetMeta {
  return { visible: true, sizePreference: { orientation: 'square', relativeSize: 'small' }, priority: 0 }
}
