export interface Shipment {
  id: string
  name: string
  carrier: string
  trackingNumber: string
  status: ShipmentStatus
  expectedDelivery: string | null
  expectedDeliveryDate: string | null
  trackingUrl: string | null
  orderUrl: string | null
  notes: string
  createdAt: string
  updatedAt: string
  eventCount: number
}

export type ShipmentStatus =
  | 'unknown'
  | 'label_created'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'returned'
  | 'cancelled'

export interface TrackingEvent {
  id: string
  shipmentId: string
  status: string
  location: string | null
  description: string
  occurredAt: string
  source: string
  createdAt: string
}

export interface ShipmentsResponse {
  shipments: Shipment[]
}

export interface EventsResponse {
  events: TrackingEvent[]
}

export const STATUS_ICONS: Record<ShipmentStatus, string> = {
  label_created: '\uD83D\uDCCB',
  shipped: '\uD83D\uDCE6',
  in_transit: '\uD83D\uDCE6',
  out_for_delivery: '\uD83D\uDE9A',
  delivered: '\u2705',
  exception: '\u26A0\uFE0F',
  returned: '\u21A9\uFE0F',
  cancelled: '\u274C',
  unknown: '\u2753',
}

export const STATUS_LABELS: Record<ShipmentStatus, string> = {
  label_created: 'Label created',
  shipped: 'Shipped',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  exception: 'Exception',
  returned: 'Returned',
  cancelled: 'Cancelled',
  unknown: 'Unknown',
}
