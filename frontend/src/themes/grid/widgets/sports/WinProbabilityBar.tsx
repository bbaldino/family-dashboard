import type { WinProbability } from '@/data/sports'

interface WinProbabilityBarProps {
  win: WinProbability
  homeAbbr: string
  awayAbbr: string
}

export function WinProbabilityBar({ win, homeAbbr, awayAbbr }: WinProbabilityBarProps) {
  const homePct = Math.round(win.home * 100)
  const awayPct = 100 - homePct
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-text-muted mb-1">
        <span>
          {awayAbbr} {awayPct}%
        </span>
        <span>Win Probability</span>
        <span>
          {homePct}% {homeAbbr}
        </span>
      </div>
      <div className="relative w-full h-2 rounded-full overflow-hidden bg-bg-primary">
        <div className="absolute inset-y-0 left-0 bg-palette-3" style={{ width: `${awayPct}%` }} />
        <div className="absolute inset-y-0 right-0 bg-palette-6" style={{ width: `${homePct}%` }} />
      </div>
    </div>
  )
}
