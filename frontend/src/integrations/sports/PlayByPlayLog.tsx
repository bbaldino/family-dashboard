import type { Play } from './types'

interface PlayByPlayLogProps {
  plays: Play[]
  homeTeamId: string
  awayTeamId: string
  /** Optional abbreviations to render as a small prefix tag per play. */
  homeAbbr?: string
  awayAbbr?: string
}

/** Pick the text color for a play row based on which team it belongs to. */
export function teamTextColor(
  teamId: string | null,
  homeTeamId: string,
  awayTeamId: string,
): string {
  if (teamId === homeTeamId) return 'text-palette-6'
  if (teamId === awayTeamId) return 'text-palette-3'
  return 'text-text-primary'
}

export function PlayByPlayLog({
  plays,
  homeTeamId,
  awayTeamId,
  homeAbbr,
  awayAbbr,
}: PlayByPlayLogProps) {
  if (plays.length === 0) return null

  const abbrFor = (teamId: string | null): string => {
    if (teamId === homeTeamId) return homeAbbr ?? ''
    if (teamId === awayTeamId) return awayAbbr ?? ''
    return ''
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-text-muted">Recent</div>
      <ul className="flex flex-col gap-0.5">
        {plays.map((play) => {
          const color = teamTextColor(play.teamId, homeTeamId, awayTeamId)
          const abbr = abbrFor(play.teamId)
          return (
            <li
              key={play.id}
              className={`text-[12px] leading-snug flex gap-2 ${play.scoring ? 'font-semibold' : ''}`}
            >
              {abbr && (
                <span className="text-text-muted tabular-nums shrink-0 w-7">{abbr}</span>
              )}
              <span className={`min-w-0 truncate ${color}`}>{play.text}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
