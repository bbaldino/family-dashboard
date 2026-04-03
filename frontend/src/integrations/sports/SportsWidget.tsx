import { useState } from 'react'
import { WidgetCard } from '@/ui/WidgetCard'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import type { WidgetSize } from '@/lib/widget-types'
import { useSportsGames } from './useSportsGames'
import { GameCard } from './GameCard'
import { GameCardCompact } from './GameCardCompact'
import { GameCardExpanded } from './GameCardExpanded'
import { GameDetailModal } from './GameDetailModal'
import type { Game } from './types'

interface SportsWidgetProps {
  size?: WidgetSize
}

function pickFeaturedGame(games: Game[]): Game | undefined {
  return (
    games.find((g) => g.state === 'live') ??
    games.find((g) => g.state === 'upcoming') ??
    games.find((g) => g.state === 'final')
  )
}

export function SportsWidget({ size = 'standard' }: SportsWidgetProps) {
  const { data, isLoading, error, refetch } = useSportsGames()
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)

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
            className="ml-2 text-palette-6 underline"
          >
            Retry
          </button>
        </div>
      </WidgetCard>
    )
  }

  if (games.length === 0) {
    return (
      <WidgetCard title="Sports" category="sports">
        <div className="text-[13px] text-text-muted py-1">
          {data ? 'No games today' : 'Select teams in Settings to get started'}
        </div>
      </WidgetCard>
    )
  }

  if (size === 'compact') {
    return (
      <WidgetCard
        title="Sports"
        category="sports"
        badge={liveCount > 0 ? `${liveCount} Live` : undefined}
      >
        <div className="flex flex-col">
          {games.slice(0, 3).map((game) => (
            <GameCardCompact key={game.id} game={game} />
          ))}
        </div>
      </WidgetCard>
    )
  }

  if (size === 'expanded') {
    const featured = pickFeaturedGame(games)
    const rest = featured ? games.filter((g) => g.id !== featured.id) : games

    return (
      <>
        <WidgetCard
          title="Sports"
          category="sports"
          badge={liveCount > 0 ? `${liveCount} Live` : undefined}
        >
          {featured && (
            <GameCardExpanded
              game={featured}
              allGames={games}
              onClick={() => setSelectedGame(featured)}
            />
          )}
          {rest.length > 0 && (
            <div className={`flex flex-col ${featured ? 'mt-3 pt-3 border-t border-border' : ''}`}>
              {rest.map((game) => (
                <GameCard key={game.id} game={game} onClick={() => setSelectedGame(game)} />
              ))}
            </div>
          )}
        </WidgetCard>
        <GameDetailModal game={selectedGame} onClose={() => setSelectedGame(null)} />
      </>
    )
  }

  // Standard (default)
  return (
    <>
      <WidgetCard
        title="Sports"
        category="sports"
        badge={liveCount > 0 ? `${liveCount} Live` : undefined}
      >
        <div className="flex flex-col">
          {games.map((game) => (
            <GameCard key={game.id} game={game} onClick={() => setSelectedGame(game)} />
          ))}
        </div>
      </WidgetCard>
      <GameDetailModal game={selectedGame} onClose={() => setSelectedGame(null)} />
    </>
  )
}
