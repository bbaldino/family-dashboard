import type { Game } from '@/integrations/sports'

/**
 * Prefer a live game; otherwise the next upcoming one. Both `SportsColumn`
 * (whose summaries this leads, via `orderSummaries`) and `Home` (which
 * derives the body's live/not-live column ratios from it) pick the same way.
 *
 * Lives in its own module, not `SportsColumn.tsx`, because a file that
 * exports a component can only export components — react-refresh enforces
 * this — and `Home` needs this exact function, not a re-derived copy, so
 * the two call sites can never disagree about whether a game is "live".
 */
export function pickFeaturedGame(games: Game[]): Game | undefined {
  return games.find((g) => g.state === 'live') ?? games.find((g) => g.state === 'upcoming')
}

/**
 * Every game the Home sports column has a summary for, most relevant first:
 * the featured game (live, else the next upcoming), then any other live
 * games, then the other upcoming games soonest first, then finals, most
 * recent first. With nothing live or upcoming, the most recent final leads.
 * Postponed games have no summary, so they aren't here.
 *
 * A final whose team has a newer game in the feed is left out: once tonight's
 * game is scheduled, last night's result is old news for that team, and it
 * used to stand in for the preview that had no slot.
 *
 * `SportsColumn` shows as many of these whole as fit, in this order, and
 * lists the rest in the "Also today" strip.
 *
 * There is deliberately no time bound on finals. The backend only ever
 * returns finals that started within its configured `window_hours`, so a
 * final being present *is* the "recent enough" condition — re-deriving a
 * second window here would give two notions of it, free to drift apart.
 */
export function orderSummaries(games: Game[]): Game[] {
  const featured = pickFeaturedGame(games)
  const others = games.filter((g) => g !== featured)
  const live = others.filter((g) => g.state === 'live')
  const upcoming = others.filter((g) => g.state === 'upcoming').sort((a, b) => newestFirst(b, a))
  const finals = others
    .filter((g) => g.state === 'final' && !hasNewerGame(g, games))
    .sort(newestFirst)
  return [...(featured ? [featured] : []), ...live, ...upcoming, ...finals]
}

/** Whether either of `final`'s teams plays again later in `games` — the same
 *  team meaning the same id in the same league (ids repeat across leagues). */
function hasNewerGame(final: Game, games: Game[]): boolean {
  const teams = new Set([final.home?.id, final.away?.id].filter(Boolean))
  if (teams.size === 0) return false
  return games.some(
    (g) =>
      g !== final &&
      g.league === final.league &&
      g.state !== 'postponed' &&
      newestFirst(g, final) < 0 &&
      (teams.has(g.home?.id) || teams.has(g.away?.id)),
  )
}

/** Parsed, never compared as text: `startTime` arrives both as `...T20:10Z`
 *  and with a numeric offset, and those two forms do not sort against each
 *  other lexically. An unparseable time sorts last rather than dropping the
 *  game — its result is still worth showing. */
function newestFirst(a: Game, b: Game): number {
  const ms = (g: Game) => {
    const t = new Date(g.startTime).getTime()
    return Number.isNaN(t) ? -Infinity : t
  }
  const diff = ms(b) - ms(a)
  // Two unparseable times give -Infinity - -Infinity = NaN; call them equal.
  return Number.isNaN(diff) ? 0 : diff
}
