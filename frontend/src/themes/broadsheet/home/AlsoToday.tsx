import { formatUpcomingTime } from '@/integrations/sports'
import type { Game } from '@/integrations/sports'
import { Kicker } from '@/themes/broadsheet/ui/Kicker'

/** Games shown before the rest collapse to "+N more" — the summaries above
 *  are dense, and this strip is a footnote to them, not a second lead. */
const MAX_ALSO_TODAY_GAMES = 2

const monoStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '0.06em',
} as const

/** `ARI 20 · SF 29`, away first, as every other score line in the theme. */
function scoreline(game: Game): string {
  const side = (team: Game['home']) => `${team.abbreviation} ${team.score ?? '—'}`
  return `${side(game.away)} · ${side(game.home)}`
}

/** A live game leads with its score and trails its clock; a final leads with
 *  the result label (`Final/10` carries extra innings) the way `FinalReport`
 *  heads its own strip; a game still to come is its matchup and start time. */
function entryText(game: Game): string {
  if (game.state === 'final') return `${game.periodLabel ?? 'Final'} · ${scoreline(game)}`
  if (game.state === 'upcoming') {
    return `${game.away.abbreviation} @ ${game.home.abbreviation} · ${formatUpcomingTime(game.startTime)}`
  }
  return game.periodLabel ? `${scoreline(game)} · ${game.periodLabel}` : scoreline(game)
}

/**
 * The summaries that didn't fit the column: every game in `summaries` (in
 * `orderSummaries` order — live, then upcoming, then finals) not in
 * `shownIds`, as compact entries at the column's foot, so a game that can't
 * have its full summary still doesn't vanish from Home. Taking the ordered
 * summaries rather than every game means a final already superseded by its
 * team's next game is left out here too.
 *
 * **One row, not a line per game.** Measured on the 1920×1080 canvas with a
 * fully dense MLB panel above (matchup, three leaders a side, a scoring
 * recap, three recent plays), a stacked list overran the column's foot and
 * clipped its second line; the column is wide enough to carry both entries
 * side by side.
 *
 * The league leads each entry: two games can share a city's abbreviation (the
 * 49ers and the Giants are both `SF`), and the entry has no logo to tell them
 * apart.
 */
export function AlsoToday({
  summaries,
  shownIds,
}: {
  summaries: Game[]
  shownIds: ReadonlySet<string>
}) {
  const others = summaries.filter((g) => !shownIds.has(g.id))
  if (others.length === 0) return null

  const visible = others.slice(0, MAX_ALSO_TODAY_GAMES)
  const hiddenCount = others.length - visible.length

  return (
    <div
      data-testid="also-today"
      className="pt-2.5 mt-3 flex items-baseline gap-5 min-w-0"
      style={{ borderTop: '1px solid var(--rule)' }}
    >
      <Kicker color="var(--ink-muted)">Also today</Kicker>
      <ul className="m-0 p-0 flex items-baseline gap-5 min-w-0" style={{ listStyle: 'none' }}>
        {visible.map((game) => (
          <li key={game.id} className="flex items-baseline gap-2 min-w-0">
            <span style={{ ...monoStyle, fontSize: 9, color: 'var(--ink-muted)' }}>
              {game.league.toUpperCase()}
            </span>
            {game.state === 'live' && (
              <span
                className="rounded-full flex-shrink-0"
                style={{ width: 6, height: 6, background: 'var(--rust)', alignSelf: 'center' }}
              />
            )}
            <span
              className="truncate"
              style={{
                ...monoStyle,
                color: game.state === 'live' ? 'var(--ink)' : 'var(--ink-muted)',
              }}
            >
              {entryText(game)}
            </span>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <span
          className="flex-shrink-0"
          style={{ ...monoStyle, fontSize: 9, color: 'var(--ink-muted)' }}
        >
          +{hiddenCount} more
        </span>
      )}
    </div>
  )
}
