import type { GameTeam, Play, ScoringRecap } from '@/data/sports'
import { TeamDot } from './PlayByPlayLog'
import { teamFor } from './team-utils'

interface ScoringSummaryProps {
  /** All scoring plays — used as the raw fallback when no recap is available. */
  allPlays: Play[]
  /** Plays in the current, still-in-progress half-inning. */
  inProgressPlays: Play[]
  /** LLM-generated narrative of every completed-inning scoring play. */
  recap: ScoringRecap | null
  home: GameTeam
  away: GameTeam
}

function inningLabel(play: Play): string {
  if (!play.inningNumber) return ''
  const half = play.inningHalf?.toLowerCase() === 'top' ? 'T' : 'B'
  return `${half}${play.inningNumber}`
}

function PlayRow({
  play,
  home,
  away,
}: {
  play: Play
  home: GameTeam
  away: GameTeam
}) {
  const team = teamFor(play.teamId, home, away)
  return (
    <li className="text-[12px] leading-snug flex items-center gap-2 text-text-primary font-semibold">
      <TeamDot team={team} />
      <span className="text-text-muted tabular-nums shrink-0 w-7">
        {inningLabel(play)}
      </span>
      <span className="min-w-0">{play.text}</span>
    </li>
  )
}

export function ScoringSummary({
  allPlays,
  inProgressPlays,
  recap,
  home,
  away,
}: ScoringSummaryProps) {
  if (allPlays.length === 0) return null

  if (!recap) {
    return (
      <div className="flex flex-col gap-1 pt-2 border-t border-border">
        <div className="text-[10px] text-text-muted font-semibold">Scoring</div>
        <ul className="flex flex-col gap-0.5">
          {allPlays.map((play) => (
            <PlayRow key={play.id} play={play} home={home} away={away} />
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-border">
      <div className="flex flex-col gap-1">
        <div className="text-[10px] text-text-muted font-semibold">Scoring</div>
        <p className="text-[12px] leading-snug text-text-primary">{recap.text}</p>
      </div>
      {inProgressPlays.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {inProgressPlays.map((play) => (
            <PlayRow key={play.id} play={play} home={home} away={away} />
          ))}
        </ul>
      )}
    </div>
  )
}
