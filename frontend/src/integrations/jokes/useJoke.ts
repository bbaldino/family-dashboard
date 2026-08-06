import { useQuery } from '@tanstack/react-query'
import { jokesIntegration } from './config'

export interface JokeData {
  type: 'twopart' | 'single'
  setup: string | null
  delivery: string | null
  joke: string | null
}

export function useJoke() {
  return useQuery({
    queryKey: ['jokes'],
    queryFn: () => jokesIntegration.api.get<JokeData>('/today'),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
    retry: 1,
  })
}
