import { useQuery } from '@tanstack/react-query'
import { sportsIntegration } from './config'

interface AiFinalRecapProps {
  gameId: string
}

export function AiFinalRecap({ gameId }: AiFinalRecapProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sports', 'final-recap', gameId],
    queryFn: () =>
      sportsIntegration.api.get<{ summary: string }>(
        `/final-recap?game_id=${encodeURIComponent(gameId)}`,
      ),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="mt-3 text-xs text-text-muted italic animate-pulse">
        Generating recap...
      </div>
    )
  }

  if (error || !data?.summary) return null

  return (
    <div className="mt-3 border-t border-border pt-2">
      <div className="text-xs text-text-secondary italic leading-relaxed">
        {data.summary}
      </div>
    </div>
  )
}
