import type { Game } from '@/integrations/sports'

/**
 * Prefer a live game; otherwise the next upcoming one. Finals/postponed
 * games don't get a dedicated treatment on the Home screen, so both
 * `SportsColumn` (which dispatches on this pick) and `Home` (which derives
 * the body's live/not-live column ratios from it) fall back the same way.
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
 * The most recent completed game, or `undefined` if there are none.
 *
 * There is deliberately no time bound here. The backend only ever returns
 * finals that started within its configured `window_hours`, so a final being
 * present *is* the "recent enough" condition — re-deriving a second window
 * here would give two notions of it, free to drift apart.
 */
export function pickPriorFinal(games: Game[]): Game | undefined {
  let latest: Game | undefined
  let latestMs = -Infinity

  for (const game of games) {
    if (game.state !== 'final') continue
    // Parsed, never compared as text: `startTime` arrives both as `...T20:10Z`
    // and with a numeric offset, and those two forms do not sort against each
    // other lexically.
    const ms = new Date(game.startTime).getTime()
    if (Number.isNaN(ms) || ms <= latestMs) continue
    latestMs = ms
    latest = game
  }

  return latest
}
