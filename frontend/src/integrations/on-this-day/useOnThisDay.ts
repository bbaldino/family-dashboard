import { useQuery } from '@tanstack/react-query'
import { onThisDayIntegration } from './config'

export interface OnThisDayEvent {
  year: number | null
  text: string
}

export interface OnThisDayBirth {
  year: number
  name: string
  role: string
}

export interface OnThisDayData {
  events: OnThisDayEvent[]
  births: OnThisDayBirth[]
}

export function useOnThisDay() {
  return useQuery({
    queryKey: ['on-this-day', 'events'],
    queryFn: () => onThisDayIntegration.api.get<OnThisDayData>('/events'),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  })
}
