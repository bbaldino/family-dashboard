import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Game, GamesResponse } from '@/integrations/sports'
import { OffdayBlock } from './OffdayBlock'
import { PregameBlock } from './PregameBlock'
import { LiveGame } from './LiveGame'
import { FinalReport } from './FinalReport'
import { AlsoToday } from './AlsoToday'
import { orderSummaries } from './featured-game'
import { fitSummaryCount } from './summary-fit'
import { shownFitStyle, hiddenFitStyle } from '@/themes/broadsheet/fit-styles'

/** Space above a live game that follows another summary. `FinalReport`
 *  brings its own rule and margin, and the pregame block only ever leads, so
 *  this is the one summary that needs a gap supplied. */
const FOLLOWING_LIVE_GAP = 24

/** One game's summary, by state. */
function Summary({ game, lead }: { game: Game; lead: boolean }) {
  if (game.state === 'live') {
    return lead ? (
      <LiveGame game={game} />
    ) : (
      <div style={{ paddingTop: FOLLOWING_LIVE_GAP }}>
        <LiveGame game={game} />
      </div>
    )
  }
  if (game.state === 'upcoming') return <PregameBlock game={game} />
  return <FinalReport game={game} />
}

/**
 * The right column of the Home screen: as many whole game summaries as fit,
 * most relevant first — a live game, else the next game's pregame preview,
 * else the most recent final leads; other live games and then finals follow
 * — and an "Also today" strip at the foot naming any that didn't fit. Only a
 * genuinely empty schedule falls through to the off-day block.
 *
 * **Fit by measurement, not a fixed count.** Every summary is rendered once;
 * each is measured where it stands, and the ones that don't fit are laid out
 * invisibly rather than unmounted, so their heights stay known and they can
 * return when there's room — a recap arriving, or a panel getting shorter.
 * Heights are re-read after every render and whenever the column or a
 * summary resizes; the count only settles, it can't oscillate, because
 * hiding a summary doesn't change any height being measured.
 *
 * The strip is pinned to the column's foot: if the lead alone overruns, its
 * tail clips rather than the strip, which would clip whole.
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
  const summaries = orderSummaries(games)

  const rootRef = useRef<HTMLDivElement>(null)
  // Starts at the lead alone, so the first paint can only under-fill, never
  // overflow; the layout effect below corrects it before anything paints.
  const [shownCount, setShownCount] = useState(1)
  // The strip is one row, so its height hardly varies; it's kept from the
  // last time it rendered. It renders on the first pass whenever there are
  // two or more summaries (only the lead is shown then), so this is a real
  // measurement before it's ever needed — the initial value is never used
  // for a decision in practice.
  const stripHeightRef = useRef(0)

  const measure = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const strip = root.querySelector<HTMLElement>('[data-strip-slot]')
    if (strip && strip.offsetHeight > 0) stripHeightRef.current = strip.offsetHeight
    const heights = [...root.querySelectorAll<HTMLElement>('[data-summary-id]')].map(
      (el) => el.offsetHeight,
    )
    setShownCount(fitSummaryCount(heights, root.clientHeight, stripHeightRef.current))
  }, [])

  // Every render: a changed game list or a newly loaded recap can change any
  // height. Setting the same count bails out, so this can't loop.
  useLayoutEffect(measure)

  const summaryIds = summaries.map((g) => g.id).join('|')
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    root.querySelectorAll('[data-summary-id]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [summaryIds, measure])

  if (summaries.length === 0) {
    return <OffdayBlock data={data} isLoading={isLoading} />
  }

  const shownIds = new Set(summaries.slice(0, shownCount).map((g) => g.id))
  const hasLeftovers = shownCount < summaries.length

  return (
    <div ref={rootRef} data-testid="sports-column" className="flex flex-col h-full min-h-0">
      <div className="relative min-h-0 overflow-hidden">
        {summaries.map((game, i) => {
          const shown = i < shownCount
          return (
            <div
              key={game.id}
              data-summary-id={game.id}
              aria-hidden={shown ? undefined : true}
              style={shown ? shownFitStyle : hiddenFitStyle}
            >
              <Summary game={game} lead={i === 0} />
            </div>
          )
        })}
      </div>
      {hasLeftovers && (
        <div data-strip-slot className="flex-shrink-0">
          <AlsoToday games={games} shownIds={shownIds} />
        </div>
      )}
    </div>
  )
}
