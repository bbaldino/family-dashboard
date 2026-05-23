import type { Play, ScoringRecap } from './types'
import { teamTextColor } from './PlayByPlayLog'

interface ScoringSummaryProps {
  /** All scoring plays — used as the raw fallback when no recap is available. */
  allPlays: Play[]
  /** Plays in the current, still-in-progress half-inning. */
  inProgressPlays: Play[]
  /** LLM-generated narrative of every completed-inning scoring play. */
  recap: ScoringRecap | null
  homeTeamId: string
  awayTeamId: string
}

function inningLabel(play: Play): string {
  if (!play.inningNumber) return ''
  const half = play.inningHalf?.toLowerCase() === 'top' ? 'T' : 'B'
  return `${half}${play.inningNumber}`
}

function PlayRow({
  play,
  homeTeamId,
  awayTeamId,
}: {
  play: Play
  homeTeamId: string
  awayTeamId: string
}) {
  const color = teamTextColor(play.teamId, homeTeamId, awayTeamId)
  return (
    <li className="text-[12px] leading-snug flex gap-2 font-semibold">
      <span className="text-text-muted tabular-nums shrink-0 w-7">
        {inningLabel(play)}
      </span>
      <span className={`min-w-0 ${color}`}>{play.text}</span>
    </li>
  )
}

export function ScoringSummary({
  allPlays,
  inProgressPlays,
  recap,
  homeTeamId,
  awayTeamId,
}: ScoringSummaryProps) {
  if (allPlays.length === 0) return null

  if (!recap) {
    return (
      <div className="flex flex-col gap-1 pt-2 border-t border-border">
        <div className="text-[10px] text-text-muted font-semibold">Scoring</div>
        <ul className="flex flex-col gap-0.5">
          {allPlays.map((play) => (
            <PlayRow
              key={play.id}
              play={play}
              homeTeamId={homeTeamId}
              awayTeamId={awayTeamId}
            />
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
            <PlayRow
              key={play.id}
              play={play}
              homeTeamId={homeTeamId}
              awayTeamId={awayTeamId}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
