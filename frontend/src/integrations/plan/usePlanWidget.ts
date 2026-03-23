import { usePolling, type UsePollingResult } from '@/hooks/usePolling'
import { useIntegrationConfig } from '@/integrations/use-integration-config'
import { planIntegration } from './config'

export interface UpcomingPlan {
  id: string
  planType: string
  name: string
  status: string
  startDate?: string
  endDate?: string
  checklistProgress?: { total: number; completed: number }
  nextItineraryItem?: { name: string; category: string; startAt: string; startTz?: string }
  itemCounts: { confirmed: number; ideas: number }
}

export type PlanWidgetData = UsePollingResult<UpcomingPlan[]>

export function usePlanWidget(): PlanWidgetData {
  const config = useIntegrationConfig(planIntegration)

  const serviceUrl = config?.service_url ?? 'http://localhost:4000'

  return usePolling<UpcomingPlan[]>({
    queryKey: ['plan-upcoming', serviceUrl],
    fetcher: async () => {
      const resp = await fetch(`${serviceUrl}/api/plans/upcoming?days=30`)
      if (!resp.ok) {
        throw new Error(`PLAN service error: ${resp.status}`)
      }
      return resp.json()
    },
    intervalMs: 5 * 60 * 1000, // 5 minutes
    enabled: !!config,
  })
}
