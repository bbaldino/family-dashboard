import type { GameTeam } from '@/data/sports'

export function teamFor(
  teamId: string | null,
  home: GameTeam,
  away: GameTeam,
): GameTeam | null {
  if (teamId === home.id) return home
  if (teamId === away.id) return away
  return null
}
