import type { WidgetMeta } from '@/lib/widget-types'
import { useLunchMenu } from './useLunchMenu'

export function useLunchWidgetMeta(): WidgetMeta {
  const { data } = useLunchMenu()

  const hasToday = data?.today != null
  const hasTomorrow = data?.tomorrow != null

  if (!hasToday && !hasTomorrow) {
    return { visible: false }
  }

  if (hasToday) {
    return { visible: true, sizePreference: { orientation: 'square', relativeSize: 'large' }, priority: 3 }
  }

  // Tomorrow only
  return { visible: true, sizePreference: { orientation: 'square', relativeSize: 'medium' }, priority: 1 }
}
