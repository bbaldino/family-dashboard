import type { Play } from './types'

interface ScoringSummaryProps {
  plays: Play[]
}

function inningLabel(play: Play): string {
  if (!play.inningNumber) return ''
  const half = play.inningHalf?.toLowerCase() === 'top' ? 'T' : 'B'
  return `${half}${play.inningNumber}`
}

export function ScoringSummary({ plays }: ScoringSummaryProps) {
  if (plays.length === 0) return null
  return (
    <div className="flex flex-col gap-1 pt-2 border-t border-border">
      <div className="text-[10px] text-text-muted font-semibold">Scoring</div>
      <ul className="flex flex-col gap-0.5">
        {plays.map((play) => (
          <li
            key={play.id}
            className="text-[12px] leading-snug text-text-primary flex gap-2"
          >
            <span className="text-text-muted tabular-nums shrink-0 w-7">
              {inningLabel(play)}
            </span>
            <span className="min-w-0">{play.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
