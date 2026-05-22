import type { MlbSituationData } from './types'
import { BaseDiamond } from './BaseDiamond'
import { CountIndicator } from './CountIndicator'

interface MlbSituationProps {
  situation: MlbSituationData
}

export function MlbSituation({ situation }: MlbSituationProps) {
  return (
    <div className="flex items-center gap-4 mt-3 py-2.5 px-3 bg-bg-primary/50 rounded-lg">
      <BaseDiamond
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
          <CountIndicator label="B" filled={situation.balls ?? 0} total={4} color="bg-success" />
          <CountIndicator label="S" filled={situation.strikes ?? 0} total={3} color="bg-error" />
          <CountIndicator label="O" filled={situation.outs} total={3} color="bg-warning" />
        </div>
        {situation.pitcher && (
          <div className="text-[11px] text-text-muted mt-0.5">vs {situation.pitcher}</div>
        )}
      </div>
    </div>
  )
}
