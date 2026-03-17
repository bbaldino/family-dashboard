import { WidgetCard } from '@/ui/WidgetCard'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { useSportsGames } from './useSportsGames'
import { GameCard } from './GameCard'

export function SportsWidget() {
  const { data, isLoading, error, refetch } = useSportsGames()

  const games = data?.games ?? []
  const liveCount = games.filter((g) => g.state === 'live').length

  if (isLoading && games.length === 0) {
    return (
      <WidgetCard title="Sports" category="sports">
        <LoadingSpinner />
      </WidgetCard>
    )
  }

  if (error && games.length === 0) {
    return (
      <WidgetCard title="Sports" category="sports">
        <div className="text-[13px] text-text-muted">
          Unable to load scores
          <button
            onClick={() => refetch()}
            className="ml-2 text-sports underline"
          >
            Retry
          </button>
        </div>
      </WidgetCard>
    )
  }

  return (
    <WidgetCard
      title="Sports"
      category="sports"
      badge={liveCount > 0 ? `${liveCount} Live` : undefined}
    >
      {games.length === 0 ? (
        <div className="text-[13px] text-text-muted py-1">
          {data ? 'No games today' : 'Select teams in Settings to get started'}
        </div>
      ) : (
        <div className="flex flex-col">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </WidgetCard>
  )
}
