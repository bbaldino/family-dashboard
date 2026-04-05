import type { MlbSituationData } from './types'

interface MlbSituationProps {
  situation: MlbSituationData
}

function Diamond({ onFirst, onSecond, onThird }: { onFirst: boolean; onSecond: boolean; onThird: boolean }) {
  const baseStyle = (occupied: boolean) =>
    `w-[13px] h-[13px] rotate-45 rounded-[2px] border-2 ${
      occupied ? 'bg-palette-6 border-palette-6' : 'border-border bg-transparent'
    }`

  return (
    <div className="w-[52px] h-[44px] relative flex-shrink-0">
      {/* 2nd base (top center) */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 ${baseStyle(onSecond)}`} />
      {/* 3rd base (left middle) */}
      <div className={`absolute top-1/2 left-[2px] -translate-y-1/2 ${baseStyle(onThird)}`} />
      {/* 1st base (right middle) */}
      <div className={`absolute top-1/2 right-[2px] -translate-y-1/2 ${baseStyle(onFirst)}`} />
    </div>
  )
}

function CountDots({
  label,
  filled,
  total,
  color,
}: {
  label: string
  filled: number
  total: number
  color: string
}) {
  return (
    <div className="flex items-center gap-[3px]">
      <span className="text-text-muted text-[11px]">{label}</span>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full ${i < filled ? color : 'border border-border'}`}
        />
      ))}
    </div>
  )
}

export function MlbSituation({ situation }: MlbSituationProps) {
  return (
    <div className="flex items-center gap-4 mt-3 py-2.5 px-3 bg-bg-primary/50 rounded-lg">
      <Diamond
        onFirst={situation.onFirst}
        onSecond={situation.onSecond}
        onThird={situation.onThird}
      />
      <div className="flex-1 min-w-0">
        {situation.batter && (
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-semibold text-text-primary">{situation.batter}</span>
            <span className="text-[11px] text-text-muted">at bat</span>
          </div>
        )}
        <div className="flex items-center gap-3 mt-1">
          <CountDots label="B" filled={situation.balls ?? 0} total={4} color="bg-success" />
          <CountDots label="S" filled={situation.strikes ?? 0} total={3} color="bg-error" />
          <CountDots label="O" filled={situation.outs} total={3} color="bg-warning" />
        </div>
        {situation.pitcher && (
          <div className="text-[11px] text-text-muted mt-0.5">vs {situation.pitcher}</div>
        )}
      </div>
    </div>
  )
}
