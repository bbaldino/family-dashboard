import type { WidgetMeta } from '@/lib/widget-types'

export function useJokeWidgetMeta(): WidgetMeta {
  return { visible: true, sizePreference: { orientation: 'square', relativeSize: 'large' }, priority: 0 }
}
