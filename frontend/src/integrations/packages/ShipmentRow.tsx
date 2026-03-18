import type { Shipment } from './types'
import { STATUS_ICONS, STATUS_LABELS } from './types'

function formatEta(expectedDelivery: string | null): { text: string; color: string } {
  if (!expectedDelivery) return { text: '', color: 'text-text-muted' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const delivery = new Date(expectedDelivery + 'T00:00:00')

  const diffDays = Math.round((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) return { text: 'Today', color: 'text-success' }
  if (diffDays === 1) return { text: 'Tomorrow', color: 'text-[#c06830]' }

  const formatted = delivery.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  return { text: formatted, color: 'text-text-muted' }
}

function formatDeliveredAgo(updatedAt: string): string {
  const updated = new Date(updatedAt)
  const now = new Date()
  const diffHours = (now.getTime() - updated.getTime()) / (1000 * 60 * 60)

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${Math.round(diffHours)}h ago`

  const diffDays = Math.round(diffHours / 24)
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
  const eta = formatEta(shipment.expectedDelivery)

  return (
    <div
      className="flex items-center gap-[10px] py-[8px] border-b border-border last:border-b-0 cursor-pointer hover:bg-bg-card-hover rounded-lg px-1 -mx-1 transition-colors"
      onClick={onClick}
    >
      <div className={`text-[20px] flex-shrink-0 ${isDelivered ? 'opacity-40' : ''}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-[14px] font-medium truncate ${isDelivered ? 'text-text-muted' : 'text-text-primary'}`}>
          {shipment.name}
        </div>
        <div className="text-[11px] text-text-muted">
          <span className="font-medium text-text-secondary">{shipment.carrier}</span>
          {isDelivered
            ? ` · ${formatDeliveredAgo(shipment.updatedAt)}`
            : ` · ${STATUS_LABELS[shipment.status]}`
          }
        </div>
      </div>
      {!isDelivered && eta.text && (
        <div className="flex-shrink-0 text-right">
          <div className={`text-[13px] font-semibold ${eta.color}`}>{eta.text}</div>
        </div>
      )}
    </div>
  )
}
