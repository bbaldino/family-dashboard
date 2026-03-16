import type { ChoreAssignment } from './types'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { ErrorDisplay } from '@/ui/ErrorDisplay'
import { WidgetCard } from '@/ui/WidgetCard'
import { ChoresDetail } from './ChoresDetail'
import type { ChoresByChild } from './useChores'

const childColors: Record<string, string> = {}
const palette = ['#e06050', '#5080d0', '#50a050', '#c070c0', '#d0a030', '#50b0b0']
let colorIndex = 0

function getChildColor(name: string): string {
  if (!childColors[name]) {
    childColors[name] = palette[colorIndex % palette.length]
    colorIndex++
  }
  return childColors[name]
}

interface ChoresWidgetProps {
  byChild: ChoresByChild
  completedCount: number
  totalCount: number
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  completeChore: (assignmentId: number) => Promise<void>
}

export function ChoresWidget({
  byChild,
  completedCount,
  totalCount,
  isLoading,
  error,
  refetch,
  completeChore,
}: ChoresWidgetProps) {
  if (isLoading) {
    return (
      <WidgetCard title="Chores" category="chores" className="h-full">
        <LoadingSpinner />
      </WidgetCard>
    )
  }

  if (error) {
    return (
      <WidgetCard title="Chores" category="chores" className="h-full">
        <ErrorDisplay message={error} onRetry={refetch} />
      </WidgetCard>
    )
  }

  const badge = `${completedCount} of ${totalCount} done`
  const childNames = Object.keys(byChild)

  return (
    <WidgetCard
      title="Chores"
      category="chores"
      badge={badge}
      detail={
        <ChoresDetail
          byChild={byChild}
          completedCount={completedCount}
          totalCount={totalCount}
          completeChore={completeChore}
        />
      }
      className="h-full"
    >
      <div className="flex flex-col gap-3">
        {childNames.length === 0 ? (
          <div className="text-[14px] text-text-muted py-2">No chores assigned today</div>
        ) : (
          childNames.map((childName) => {
            const chores = byChild[childName]
            const color = getChildColor(childName)
            return (
              <div key={childName}>
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ background: color }}
                  >
                    {childName[0].toUpperCase()}
                  </div>
                  <span className="text-[13px] font-semibold text-text-primary">{childName}</span>
                </div>
                <div className="flex flex-col gap-[2px] pl-[30px]">
                  {chores.map((chore) => (
                    <ChoreRow key={chore.id} chore={chore} onComplete={completeChore} />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </WidgetCard>
  )
}

function ChoreRow({
  chore,
  onComplete,
}: {
  chore: ChoreAssignment
  onComplete: (id: number) => Promise<void>
}) {
  return (
    <label className="flex items-center gap-2 py-[2px] cursor-pointer">
      <input
        type="checkbox"
        checked={chore.completed}
        onChange={() => {
          if (!chore.completed) onComplete(chore.id)
        }}
        className="w-[20px] h-[20px] accent-chores rounded cursor-pointer"
      />
      <span
        className={`text-[14px] ${
          chore.completed ? 'line-through text-text-muted' : 'text-text-primary'
        }`}
      >
        {chore.chore_name}
      </span>
    </label>
  )
}
