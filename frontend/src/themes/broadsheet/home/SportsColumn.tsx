import type { GamesResponse } from '@/integrations/sports'
import { OffdayBlock } from './OffdayBlock'
import { PregameBlock } from './PregameBlock'
import { LiveGame } from './LiveGame'
import { FinalReport } from './FinalReport'
import { pickFeaturedGame, pickPriorFinal } from './featured-game'

/**
 * The right column of the Home screen: dispatches on game state. A live game
 * takes over with the full editorial treatment; a scheduled game gets the
 * pregame preview with the last result beneath it; a finished game with
 * nothing else on leads on its own; only a genuinely empty schedule falls
 * through to the off-day block.
 *
 * Takes sports data as props rather than calling `useSportsGames()` itself —
 * that hook opens its own SSE connection, and `Home` already calls it once
 * for the whole page. See `Home`'s doc comment for why.
 */
export function SportsColumn({
  data,
  isLoading,
}: {
  data: GamesResponse | undefined
  isLoading: boolean
}) {
  const games = data?.games ?? []
  const featured = pickFeaturedGame(games)
  const priorFinal = pickPriorFinal(games)

  // A live game takes the column whole. The final report is deliberately not
  // shown beside it — that is the "or the next game had started" half of the
  // rule, and expressing it this way means it needs no clock of its own.
  if (featured?.state === 'live') {
    return <LiveGame game={featured} />
  }

  if (featured) {
    return (
      <>
        <PregameBlock game={featured} />
        {priorFinal && <FinalReport game={priorFinal} />}
      </>
    )
  }

  // A finished game leads rather than falling through to the off-day block.
  // Without this rung the column announced "No game today." on an afternoon
  // when a game had been played and was over — true only of what is still to
  // come, and plainly false to anyone who had watched it.
  if (priorFinal) {
    return <FinalReport game={priorFinal} />
  }

  return <OffdayBlock data={data} isLoading={isLoading} />
}
