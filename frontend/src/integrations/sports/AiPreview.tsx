import { useQuery } from '@tanstack/react-query'
import { sportsIntegration } from './config'

interface AiPreviewProps {
  gameId: string
}

export function AiPreview({ gameId }: AiPreviewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['sports', 'preview', gameId],
    queryFn: () =>
      sportsIntegration.api.get<{ summary: string }>(`/preview?game_id=${encodeURIComponent(gameId)}`),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 1,
  })

  if (isLoading) {
    return (
      <div className="mt-3 text-xs text-text-muted italic animate-pulse">
        Generating preview...
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
