import type { Matchup } from '@/data/sports'

interface PitcherBatterMatchupProps {
  matchup: Matchup
}

function Headshot({ url, alt }: { url: string | null; alt: string }) {
  if (!url) {
    return <div className="w-16 h-16 rounded-full bg-bg-primary border border-border" />
  }
  return (
    <img
      src={url}
      alt={alt}
      className="w-16 h-16 rounded-full object-cover bg-bg-primary border border-border"
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

export function PitcherBatterMatchup({ matchup }: PitcherBatterMatchupProps) {
  const { pitcher, batter } = matchup
  return (
    <div className="flex items-stretch gap-3">
      {/* Pitcher */}
      <div className="flex-1 flex items-center gap-2">
        <Headshot url={pitcher.headshotUrl} alt={pitcher.name} />
        <div className="min-w-0">
          <div className="text-[12px] text-text-muted">Pitching {pitcher.hand ? `(${pitcher.hand})` : ''}</div>
          <div className="text-[14px] font-semibold text-text-primary truncate">{pitcher.name}</div>
          <div className="text-[11px] text-text-muted">
            {pitcher.era ? `ERA ${pitcher.era}` : ''}
            {pitcher.pitchesToday != null ? ` · ${pitcher.pitchesToday} P` : ''}
          </div>
        </div>
      </div>
      <div className="self-center text-text-muted text-[10px]">vs</div>
      {/* Batter */}
      <div className="flex-1 flex items-center gap-2">
        <Headshot url={batter.headshotUrl} alt={batter.name} />
        <div className="min-w-0">
          <div className="text-[12px] text-text-muted">At Bat {batter.hand ? `(${batter.hand})` : ''}</div>
          <div className="text-[14px] font-semibold text-text-primary truncate">{batter.name}</div>
          <div className="text-[11px] text-text-muted">
            {batter.avg ? batter.avg : ''}
            {batter.todayLine ? ` · ${batter.todayLine}` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
