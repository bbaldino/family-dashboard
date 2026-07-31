import { useSportsGames } from '@/data/sports'
import type { Game } from '@/data/sports'
import { OffdayBlock } from './OffdayBlock'
import { PregameBlock } from './PregameBlock'
import { LiveGame } from './LiveGame'

/** Prefer a live game; otherwise the next upcoming one. Finals/postponed
 *  games don't get a dedicated treatment here, so the column falls back to
 *  the off-day block for them too. */
function pickFeaturedGame(games: Game[]): Game | undefined {
  return games.find((g) => g.state === 'live') ?? games.find((g) => g.state === 'upcoming')
}

/**
 * The right column of the Home screen: dispatches on game state. A live
 * game takes over with the full editorial treatment; a scheduled game gets
 * the pregame preview; anything else — no tracked games, only finals,
 * postponed, or still loading — falls back to the off-day block.
 */
export function SportsColumn() {
  const { data } = useSportsGames()
  const games = data?.games ?? []
  const featured = pickFeaturedGame(games)

  if (!featured) {
    return <OffdayBlock />
  }
  if (featured.state === 'live') {
    return <LiveGame game={featured} />
  }
  return <PregameBlock game={featured} />
}
