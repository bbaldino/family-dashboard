import { useQuery } from '@tanstack/react-query'
import { dailyQuoteIntegration } from './config'

export interface DailyQuoteData {
  quote: string
  author: string
}

export function useDailyQuote() {
  return useQuery({
    queryKey: ['daily-quote'],
    queryFn: () => dailyQuoteIntegration.api.get<DailyQuoteData>('/today'),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
  })
}
