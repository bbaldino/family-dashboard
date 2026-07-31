import type { Game, GamesResponse } from '@/data/sports'
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
 *
 * Takes sports data as props rather than calling `useSportsGames()` itself —
 * that hook opens its own SSE connection, and `Home` already calls it once
 * for the whole page. See `Home`'s doc comment for why.
 */
export function SportsColumn({ data, isLoading }: { data: GamesResponse | undefined; isLoading: boolean }) {
  const games = data?.games ?? []
  const featured = pickFeaturedGame(games)

  if (!featured) {
    return <OffdayBlock data={data} isLoading={isLoading} />
  }
  if (featured.state === 'live') {
    return <LiveGame game={featured} />
  }
  return <PregameBlock game={featured} />
}
