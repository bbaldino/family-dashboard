import type { GameTeam, Play } from '@/integrations/sports'
import { teamFor } from './team-utils'

interface PlayByPlayLogProps {
  plays: Play[]
  home: GameTeam
  away: GameTeam
}

/** A small colored circle in the team's primary color. Falls back to a
 *  border-only dot when no color is available. */
export function TeamDot({ team }: { team: GameTeam | null }) {
  const hex = team?.color
  if (!hex) {
    return <span className="inline-block w-2.5 h-2.5 rounded-full border border-border shrink-0" />
  }
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ backgroundColor: `#${hex}` }}
    />
  )
}

export function PlayByPlayLog({ plays, home, away }: PlayByPlayLogProps) {
  if (plays.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-text-muted">Recent</div>
      <ul className="flex flex-col gap-0.5">
        {plays.map((play) => {
          const team = teamFor(play.teamId, home, away)
          const abbr = team?.abbreviation ?? ''
          return (
            <li
              key={play.id}
              className={`text-[12px] leading-snug flex items-center gap-2 text-text-primary ${play.scoring ? 'font-semibold' : ''}`}
            >
              <TeamDot team={team} />
              {abbr && <span className="text-text-muted tabular-nums shrink-0 w-9">{abbr}</span>}
              <span className="min-w-0 truncate">{play.text}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
