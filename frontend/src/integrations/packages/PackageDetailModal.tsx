import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/ui/Modal'
import { packagesIntegration } from './config'
import type { Shipment, EventsResponse } from './types'
import { STATUS_ICONS } from './types'

interface PackageDetailModalProps {
  shipment: Shipment | null
  onClose: () => void
}

export function PackageDetailModal({ shipment, onClose }: PackageDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['packages', 'events', shipment?.id],
    queryFn: () =>
      packagesIntegration.api.get<EventsResponse>(`/shipments/${shipment!.id}/events`),
    enabled: !!shipment,
  })

  if (!shipment) return null

  const events = data?.events ?? []
  const icon = STATUS_ICONS[shipment.status] ?? '\u2753'

  return (
    <Modal isOpen={!!shipment} onClose={onClose} title={shipment.name}>
      <div className="space-y-4">
        {/* Status + carrier info */}
        <div className="flex items-center gap-3">
          <span className="text-[24px]">{icon}</span>
          <div>
            <div className="text-[14px] font-medium text-text-primary">
              {shipment.carrier}
            </div>
            {shipment.trackingNumber && (
              <div className="text-[12px] text-text-muted font-mono">
                {shipment.trackingNumber}
              </div>
            )}
          </div>
          {shipment.expectedDelivery && (
            <div className="ml-auto text-right">
              <div className="text-[11px] text-text-muted">Expected</div>
              <div className="text-[13px] font-semibold text-text-primary">
                {shipment.expectedDelivery}
              </div>
            </div>
          )}
        </div>

        {/* Tracking timeline */}
        <div>
          <div className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.3px] mb-2">
            Tracking History
          </div>
          {isLoading ? (
            <div className="text-[13px] text-text-muted py-2">Loading...</div>
          ) : events.length === 0 ? (
            <div className="text-[13px] text-text-muted py-2">No tracking events yet</div>
          ) : (
            <div className="space-y-0">
              {events.map((event, i) => (
                <div
                  key={event.id}
                  className="flex gap-3 py-2 border-b border-border last:border-b-0"
                >
                  <div className="flex flex-col items-center flex-shrink-0 w-[6px] mt-1">
                    <div className={`w-[6px] h-[6px] rounded-full ${i === 0 ? 'bg-palette-5' : 'bg-text-disabled'}`} />
                    {i < events.length - 1 && (
                      <div className="w-px flex-1 bg-border-subtle mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-text-primary">{event.description}</div>
                    <div className="text-[11px] text-text-muted mt-[2px]">
                      {event.location && <span>{event.location} · </span>}
                      {new Date(event.occurredAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      {new Date(event.occurredAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
