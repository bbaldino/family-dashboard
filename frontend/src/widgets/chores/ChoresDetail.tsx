import type { ChoreAssignment } from '@/lib/dashboard-api'
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

interface ChoresDetailProps {
  byChild: ChoresByChild
  completedCount: number
  totalCount: number
  completeChore: (assignmentId: number) => Promise<void>
}

export function ChoresDetail({ byChild, completedCount, totalCount, completeChore }: ChoresDetailProps) {
  const childNames = Object.keys(byChild)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[18px] font-semibold text-text-primary">Today&apos;s Chores</h2>
        <span className="text-[13px] text-text-secondary">
          {completedCount} of {totalCount} done
        </span>
      </div>
      {childNames.length === 0 ? (
        <div className="text-[14px] text-text-muted py-4">No chores assigned today</div>
      ) : (
        <div className="flex flex-col gap-5">
          {childNames.map((childName) => {
            const chores = byChild[childName]
            const color = getChildColor(childName)
            return (
              <div key={childName}>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-[13px] font-bold text-white"
                    style={{ background: color }}
                  >
                    {childName[0].toUpperCase()}
                  </div>
                  <span className="text-[15px] font-semibold text-text-primary">{childName}</span>
                </div>
                <div className="flex flex-col gap-1 pl-[36px]">
                  {chores.map((chore) => (
                    <ChoreDetailRow key={chore.id} chore={chore} onComplete={completeChore} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ChoreDetailRow({
  chore,
  onComplete,
}: {
  chore: ChoreAssignment
  onComplete: (id: number) => Promise<void>
}) {
  return (
    <label className="flex items-center gap-3 py-2 cursor-pointer border-b border-border last:border-0">
      <input
        type="checkbox"
        checked={chore.completed}
        onChange={() => {
          if (!chore.completed) onComplete(chore.id)
        }}
        className="w-[22px] h-[22px] accent-chores rounded cursor-pointer"
      />
      <span
        className={`text-[15px] ${
          chore.completed ? 'line-through text-text-muted' : 'text-text-primary'
        }`}
      >
        {chore.chore_name}
      </span>
    </label>
  )
}
