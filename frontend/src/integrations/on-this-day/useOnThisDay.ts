import { useQuery } from '@tanstack/react-query'
import { onThisDayIntegration } from './config'

export interface OnThisDayEvent {
  year: number | null
  text: string
  imageUrl: string | null
}

export interface OnThisDayData {
  events: OnThisDayEvent[]
}

export function useOnThisDay() {
  return useQuery({
    queryKey: ['on-this-day', 'events'],
    queryFn: () => onThisDayIntegration.api.get<OnThisDayData>('/events'),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  })
}
