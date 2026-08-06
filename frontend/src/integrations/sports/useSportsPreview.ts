import { useQuery } from '@tanstack/react-query'
import { sportsIntegration } from './config'

export function useSportsPreview(gameId: string) {
  return useQuery({
    queryKey: ['sports', 'preview', gameId],
    queryFn: () =>
      sportsIntegration.api.get<{ summary: string }>(
        `/preview?game_id=${encodeURIComponent(gameId)}`,
      ),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  })
}
