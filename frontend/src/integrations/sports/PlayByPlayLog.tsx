import type { Play } from './types'

interface PlayByPlayLogProps {
  plays: Play[]
}

export function PlayByPlayLog({ plays }: PlayByPlayLogProps) {
  if (plays.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] text-text-muted">Recent</div>
      <ul className="flex flex-col gap-0.5">
        {plays.map((play) => (
          <li
            key={play.id}
            className={`text-[12px] leading-snug truncate ${play.scoring ? 'text-palette-6 font-semibold' : 'text-text-primary'}`}
          >
            {play.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
