import type { WidgetMeta } from '@/lib/widget-types'
import { usePackages } from './usePackages'
import type { ShipmentStatus } from './types'

const HIDDEN_STATUSES: ShipmentStatus[] = ['cancelled', 'returned']

export function usePackagesWidgetMeta(): WidgetMeta {
  const { data } = usePackages()
  const shipments = data?.shipments ?? []

  const visible = shipments.filter((s) => !HIDDEN_STATUSES.includes(s.status))
  if (visible.length === 0) {
    return { visible: false }
  }

  const hasDeliveryToday = visible.some((s) => {
    if (s.status !== 'out_for_delivery') return false
    return true
  })

  return {
    visible: true,
    preferredSize: 'standard',
    priority: hasDeliveryToday ? 5 : 3,
  }
}
