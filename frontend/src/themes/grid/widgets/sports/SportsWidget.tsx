import { useState } from 'react'
import { WidgetCard } from '@/themes/grid/ui/WidgetCard'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import {
  formatUnavailableLeagues,
  scoreboardIsDown,
  useSportsGames,
  type Game,
} from '@/integrations/sports'
import { GameCard } from './GameCard'
import { GameCardExpanded } from './GameCardExpanded'
import { GameDetailModal } from '@/themes/grid/overlays/sports/GameDetailModal'

function pickFeaturedGame(games: Game[]): Game | undefined {
  return (
    games.find((g) => g.state === 'live') ??
    games.find((g) => g.state === 'upcoming') ??
    games.find((g) => g.state === 'final')
  )
}

export function SportsWidget() {
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
          <button onClick={() => refetch()} className="ml-2 text-palette-6 underline">
            Retry
          </button>
        </div>
      </WidgetCard>
    )
  }

  // A request that succeeded but came back with a league we couldn't reach.
  // Distinct from the error branch above (the request itself failed) and
  // from the empty branch below (nothing scheduled) — reporting it as
  // either would be the silent failure this exists to end.
  if (scoreboardIsDown(data)) {
    return (
      <WidgetCard title="Sports" category="sports">
        <div className="text-[13px] text-text-muted py-1">
          Scores unavailable — no word from{' '}
          {formatUnavailableLeagues(data?.unavailableLeagues ?? [])}
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
