import type { Shipment } from './types'
import { STATUS_ICONS, STATUS_LABELS } from './types'

function etaColor(deliveryDate: string | null): string {
  if (!deliveryDate) return 'text-text-muted'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const delivery = new Date(deliveryDate + 'T00:00:00')
  const diffDays = Math.round((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return 'text-success'
  if (diffDays === 1) return 'text-role-warning'
  return 'text-text-muted'
}

function formatDeliveredAgo(updatedAt: string): string {
  const updated = new Date(updatedAt)
  const now = new Date()
  const diffMins = (now.getTime() - updated.getTime()) / (1000 * 60)

  if (diffMins < 5) return 'Just now'
  if (diffMins < 60) return `${Math.round(diffMins)} mins ago`
  if (diffMins < 24 * 60) return `${Math.round(diffMins / 60)}h ago`

  const diffDays = Math.round(diffMins / (24 * 60))
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

interface ShipmentRowProps {
  shipment: Shipment
  onClick: () => void
}

export function ShipmentRow({ shipment, onClick }: ShipmentRowProps) {
  const isDelivered = shipment.status === 'delivered'
  const icon = STATUS_ICONS[shipment.status] ?? '\u2753'
  const color = etaColor(shipment.expectedDeliveryDate)

  return (
    <div
      className="flex items-start gap-2 py-2 border-b border-border last:border-b-0 cursor-pointer hover:bg-bg-card-hover rounded-lg px-1 -mx-1 transition-colors overflow-hidden"
      onClick={onClick}
    >
      <div className={`text-[20px] flex-shrink-0 mt-0.5 ${isDelivered ? 'opacity-40' : ''}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[14px] font-medium truncate ${isDelivered ? 'text-text-muted' : 'text-text-primary'}`}>
          {shipment.name}
        </div>
        <div className="text-[11px] text-text-muted">
          {shipment.carrier ? (
            <span className="font-medium text-text-secondary">{shipment.carrier}</span>
          ) : null}
          {isDelivered
            ? `${shipment.carrier ? ' · ' : ''}${formatDeliveredAgo(shipment.updatedAt)}`
            : `${shipment.carrier ? ' · ' : ''}${STATUS_LABELS[shipment.status]}`
          }
        </div>
        {!isDelivered && shipment.expectedDelivery && (
          <div className={`text-[11px] font-semibold mt-0.5 ${color}`}>
            {shipment.expectedDelivery}
          </div>
        )}
      </div>
    </div>
  )
}
