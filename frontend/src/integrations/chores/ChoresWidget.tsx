import { useState } from 'react'
import { LoadingSpinner } from '@/ui/LoadingSpinner'
import { ErrorDisplay } from '@/ui/ErrorDisplay'
import { WidgetCard } from '@/ui/WidgetCard'
import { useChores } from './useChores'
import { MetaChorePicker } from './MetaChorePicker'
import type { TodayAssignment, PersonAssignments } from './types'

interface PickerState {
  assignmentId: number
  pickFromTags: string[]
  currentPickId: number | null
}

export function ChoresWidget() {
  const { data, isLoading, error, refetch, completeAssignment, uncompleteAssignment, pickChore, clearPick } =
    useChores()
  const [picker, setPicker] = useState<PickerState | null>(null)

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

  const badge = data ? `${data.completed_count} of ${data.total_count} done` : undefined
  const persons = data?.persons ?? []

  return (
    <>
      <WidgetCard title="Chores" category="chores" badge={badge} className="h-full">
        <div className="flex flex-col gap-3">
          {persons.length === 0 ? (
            <div className="text-[14px] text-text-muted py-2">No chores assigned today</div>
          ) : (
            persons.map((pa) => (
              <PersonSection
                key={pa.person.id}
                personAssignments={pa}
                onComplete={completeAssignment}
                onUncomplete={uncompleteAssignment}
                onOpenPicker={(assignmentId, pickFromTags, currentPickId) =>
                  setPicker({ assignmentId, pickFromTags, currentPickId })
                }
              />
            ))
          )}
        </div>
      </WidgetCard>

      {picker && (
        <MetaChorePicker
          assignmentId={picker.assignmentId}
          pickFromTags={picker.pickFromTags}
          currentPickId={picker.currentPickId}
          onPick={pickChore}
          onClear={clearPick}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  )
}

function PersonSection({
  personAssignments,
  onComplete,
  onUncomplete,
  onOpenPicker,
}: {
  personAssignments: PersonAssignments
  onComplete: (id: number) => Promise<void>
  onUncomplete: (id: number) => Promise<void>
  onOpenPicker: (assignmentId: number, pickFromTags: string[], currentPickId: number | null) => void
}) {
  const { person, assignments } = personAssignments

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        {person.avatar ? (
          <img
            src={person.avatar}
            alt={person.name}
            className="w-[22px] h-[22px] rounded-full object-cover"
          />
        ) : (
          <div
            className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-bold text-white"
            style={{ background: person.color }}
          >
            {person.name[0].toUpperCase()}
          </div>
        )}
        <span className="text-[13px] font-semibold text-text-primary">{person.name}</span>
      </div>
      <div className="flex flex-col gap-[2px] pl-[30px]">
        {assignments.map((assignment) => (
          <AssignmentRow
            key={assignment.id}
            assignment={assignment}
            onComplete={onComplete}
            onUncomplete={onUncomplete}
            onOpenPicker={onOpenPicker}
          />
        ))}
      </div>
    </div>
  )
}

function AssignmentRow({
  assignment,
  onComplete,
  onUncomplete,
  onOpenPicker,
}: {
  assignment: TodayAssignment
  onComplete: (id: number) => Promise<void>
  onUncomplete: (id: number) => Promise<void>
  onOpenPicker: (assignmentId: number, pickFromTags: string[], currentPickId: number | null) => void
}) {
  const isMeta = assignment.chore.chore_type === 'meta'

  // Meta-chore that hasn't been picked yet
  if (isMeta && !assignment.picked_chore) {
    return (
      <div className="flex items-center gap-2 py-[2px]">
        <button
          className="text-[13px] text-chores font-medium underline"
          onClick={() =>
            onOpenPicker(assignment.id, assignment.chore.tags, null)
          }
        >
          Pick a chore
        </button>
        <span className="text-[12px] text-text-muted">({assignment.chore.name})</span>
      </div>
    )
  }

  // Regular chore or meta-chore with a pick
  const displayName = isMeta && assignment.picked_chore ? assignment.picked_chore.name : assignment.chore.name

  return (
    <div className="flex items-center gap-2 py-[2px]">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={assignment.completed}
          onChange={() => {
            if (assignment.completed) {
              onUncomplete(assignment.id)
            } else {
              onComplete(assignment.id)
            }
          }}
          className="w-[20px] h-[20px] accent-chores rounded cursor-pointer"
        />
        <span
          className={`text-[14px] ${
            assignment.completed ? 'line-through text-text-muted' : 'text-text-primary'
          }`}
        >
          {displayName}
        </span>
      </label>
      {isMeta && assignment.picked_chore && (
        <button
          className="text-[11px] text-text-secondary underline ml-1"
          onClick={() =>
            onOpenPicker(assignment.id, assignment.chore.tags, assignment.picked_chore!.id)
          }
        >
          change
        </button>
      )}
    </div>
  )
}
