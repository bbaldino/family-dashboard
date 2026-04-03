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
    return { visible: true, preferredSize: 'expanded', priority: 3 }
  }

  // Tomorrow only
  return { visible: true, preferredSize: 'standard', priority: 1 }
}
