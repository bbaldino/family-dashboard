/**
 * How the Home standfirst names a league's sport and the moment its game
 * starts. `start` is null for a league without its own word, so callers fall
 * back to neutral phrasing instead of borrowing another sport's.
 */
export interface SportWording {
  name: string
  start: string | null
}

const WORDING: Record<string, SportWording> = {
  mlb: { name: 'Baseball', start: 'first pitch' },
  nba: { name: 'Basketball', start: 'tip-off' },
  nfl: { name: 'Football', start: 'kickoff' },
  nhl: { name: 'Hockey', start: 'puck drop' },
}

export function sportWording(league: string): SportWording {
  return WORDING[league.toLowerCase()] ?? { name: league.toUpperCase(), start: null }
}
