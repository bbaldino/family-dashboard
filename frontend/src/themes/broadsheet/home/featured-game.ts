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
