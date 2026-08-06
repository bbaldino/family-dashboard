import { useQuery } from '@tanstack/react-query'
import { packagesIntegration } from './config'
import type { EventsResponse } from './types'

export function usePackageEvents(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ['packages', 'events', shipmentId],
    queryFn: () => packagesIntegration.api.get<EventsResponse>(`/shipments/${shipmentId}/events`),
    enabled: !!shipmentId,
  })
}
