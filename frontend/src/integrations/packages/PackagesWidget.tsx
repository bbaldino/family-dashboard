import { useState } from 'react'
import { WidgetCard } from '@/ui/WidgetCard'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { usePackages } from './usePackages'
import { ShipmentRow } from './ShipmentRow'
import { PackageDetailModal } from './PackageDetailModal'
import type { Shipment, ShipmentStatus } from './types'

const STATUS_ORDER: Record<ShipmentStatus, number> = {
  out_for_delivery: 0,
  in_transit: 1,
  shipped: 2,
  label_created: 3,
  exception: 4,
  unknown: 5,
  delivered: 6,
  returned: 7,
  cancelled: 8,
}

const HIDDEN_STATUSES: ShipmentStatus[] = ['cancelled', 'returned']

export function PackagesWidget() {
  const { data, isLoading, error } = usePackages()
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)

  const allShipments = data?.shipments ?? []

  const visible = allShipments
    .filter((s) => !HIDDEN_STATUSES.includes(s.status))

  const active = visible
    .filter((s) => s.status !== 'delivered')
    .sort((a, b) => {
      const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
      if (statusDiff !== 0) return statusDiff
      // Within same status, sort by delivery date (soonest first)
      return (a.expectedDeliveryDate ?? '9999').localeCompare(b.expectedDeliveryDate ?? '9999')
    })

  const delivered = visible
    .filter((s) => s.status === 'delivered')
    .sort((a, b) => (b.expectedDeliveryDate ?? '').localeCompare(a.expectedDeliveryDate ?? ''))

  const shipments = [...active, ...delivered]
  const activeCount = active.length

  if (isLoading && shipments.length === 0) {
    return (
      <WidgetCard title="Packages" category="grocery">
        <LoadingSpinner />
      </WidgetCard>
    )
  }

  if (error && shipments.length === 0) {
    return (
      <WidgetCard title="Packages" category="grocery">
        <div className="text-[13px] text-text-muted">Unable to load packages</div>
      </WidgetCard>
    )
  }

  return (
    <>
      <WidgetCard
        title="Packages"
        category="grocery"
        badge={activeCount > 0 ? `${activeCount} active` : undefined}
      >
        {shipments.length === 0 ? (
          <div className="text-[13px] text-text-muted py-1">No packages</div>
        ) : (
          <div className="flex flex-col">
            {active.map((shipment) => (
              <ShipmentRow
                key={shipment.id}
                shipment={shipment}
                onClick={() => setSelectedShipment(shipment)}
              />
            ))}
            {delivered.length > 0 && (
              <>
                <div className="text-[10px] font-semibold text-text-muted uppercase tracking-[0.3px] pt-[6px] mt-[4px]">
                  Recently delivered
                </div>
                {delivered.map((shipment) => (
                  <ShipmentRow
                    key={shipment.id}
                    shipment={shipment}
                    onClick={() => setSelectedShipment(shipment)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </WidgetCard>
      <PackageDetailModal
        shipment={selectedShipment}
        onClose={() => setSelectedShipment(null)}
      />
    </>
  )
}
