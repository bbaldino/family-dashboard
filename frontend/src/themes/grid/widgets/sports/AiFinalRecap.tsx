import { useSportsFinalRecap } from '@/data/sports'

interface AiFinalRecapProps {
  gameId: string
}

export function AiFinalRecap({ gameId }: AiFinalRecapProps) {
  const { data, isLoading, error } = useSportsFinalRecap(gameId)

  if (isLoading) {
    return (
      <div className="mt-3 text-xs text-text-muted italic animate-pulse">Generating recap...</div>
    )
  }

  if (error || !data?.summary) return null

  return (
    <div className="mt-3 border-t border-border pt-2">
      <div className="text-xs text-text-secondary italic leading-relaxed">{data.summary}</div>
    </div>
  )
}
