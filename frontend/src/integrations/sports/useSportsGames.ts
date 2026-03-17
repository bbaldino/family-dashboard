import { useQuery } from '@tanstack/react-query'
import { sportsIntegration } from './config'
import type { GamesResponse } from './types'

export function useSportsGames() {
  const query = useQuery({
    queryKey: ['sports', 'games'],
    queryFn: () => sportsIntegration.api.get<GamesResponse>('/games'),
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.hasLive) {
        return 30 * 1000
      }
      return 15 * 60 * 1000
    },
  })

  return query
}
