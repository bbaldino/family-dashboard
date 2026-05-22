import type { GameLeaders as Leaders, GameLeader } from './types'

interface GameLeadersProps {
  leaders: Leaders
  homeAbbr: string
  awayAbbr: string
}

function LeaderRow({ leader }: { leader: GameLeader }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-text-muted truncate">{leader.category}</span>
      <span className="text-text-primary truncate">{leader.playerName}</span>
      <span className="text-text-secondary tabular-nums">{leader.displayValue}</span>
    </div>
  )
}

function TeamColumn({ abbr, leaders }: { abbr: string; leaders: GameLeader[] }) {
  if (leaders.length === 0) return <div className="flex-1" />
  return (
    <div className="flex-1 flex flex-col gap-1">
      <div className="text-[10px] text-text-muted font-semibold">{abbr}</div>
      {leaders.map((leader, i) => (
        <LeaderRow key={`${leader.category}-${i}`} leader={leader} />
      ))}
    </div>
  )
}

export function GameLeaders({ leaders, homeAbbr, awayAbbr }: GameLeadersProps) {
  if (leaders.home.length === 0 && leaders.away.length === 0) return null
  return (
    <div className="flex items-stretch gap-4 pt-2 border-t border-border">
      <TeamColumn abbr={awayAbbr} leaders={leaders.away} />
      <TeamColumn abbr={homeAbbr} leaders={leaders.home} />
    </div>
  )
}
