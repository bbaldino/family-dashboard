import { useQuery } from '@tanstack/react-query'
import { packagesIntegration } from './config'
import type { ShipmentsResponse } from './types'

export function usePackages() {
  return useQuery({
    queryKey: ['packages', 'shipments'],
    queryFn: () => packagesIntegration.api.get<ShipmentsResponse>('/shipments'),
    refetchInterval: 5 * 60 * 1000,
  })
}
