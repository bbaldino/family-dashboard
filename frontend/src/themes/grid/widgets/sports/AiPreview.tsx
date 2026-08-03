import { useSportsPreview } from '@/data/sports'

interface AiPreviewProps {
  gameId: string
}

export function AiPreview({ gameId }: AiPreviewProps) {
  const { data, isLoading, error } = useSportsPreview(gameId)

  if (isLoading) {
    return (
      <div className="mt-3 text-xs text-text-muted italic animate-pulse">Generating preview...</div>
    )
  }

  if (error || !data?.summary) return null

  return (
    <div className="mt-3 border-t border-border pt-2">
      <div className="text-xs text-text-secondary italic leading-relaxed">{data.summary}</div>
    </div>
  )
}
