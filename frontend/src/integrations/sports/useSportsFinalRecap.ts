import { useQuery } from '@tanstack/react-query'
import { sportsIntegration } from './config'

export function useSportsFinalRecap(gameId: string) {
  return useQuery({
    queryKey: ['sports', 'final-recap', gameId],
    queryFn: () =>
      sportsIntegration.api.get<{ summary: string }>(
        `/final-recap?game_id=${encodeURIComponent(gameId)}`,
      ),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })
}
