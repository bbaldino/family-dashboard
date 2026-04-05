import type { WidgetMeta } from '@/lib/widget-types'

export function useJokeWidgetMeta(): WidgetMeta {
  return { visible: true, preferredSize: 'standard', priority: 0 }
}
