import type { GamesResponse } from './types'

/**
 * Whether the sports column has nothing to show *because something broke*,
 * as opposed to because there is nothing on.
 *
 * `/games` has three empty-ish outcomes and only one of them is a fault:
 * no teams tracked, teams tracked but nothing scheduled, and — this one —
 * a league the backend could not reach with no stale cache to fall back on.
 * The first two are the truth and read as "No game today."; the third read
 * identically until `unavailableLeagues` existed, which is how a broken
 * ESPN integration hid for weeks.
 *
 * Deliberately false when *some* games came through: a partial outage still
 * fills the column with real fixtures, and interrupting that to report a
 * league nobody is watching today would cost more than it buys.
 */
export function scoreboardIsDown(data: GamesResponse | undefined): boolean {
  if (!data) return false
  return data.games.length === 0 && data.unavailableLeagues.length > 0
}

/**
 * League ids as a written phrase: `"MLB"`, `"MLB or NBA"`, `"MLB, NBA or
 * NFL"`. Naming them is the whole reason the backend sends ids rather than a
 * flag — it makes the fault diagnosable from across the kitchen.
 */
export function formatUnavailableLeagues(leagues: string[]): string {
  const names = leagues.map((league) => league.toUpperCase())
  if (names.length < 2) return names.join('')
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`
}
