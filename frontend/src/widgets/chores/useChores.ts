import { useCallback } from 'react'
import { usePolling, type UsePollingResult } from '@/hooks/usePolling'
import { choresApi, type ChoreAssignment } from '@/lib/dashboard-api'

export interface ChoresByChild {
  [childName: string]: ChoreAssignment[]
}

export interface ChoresData {
  assignments: UsePollingResult<ChoreAssignment[]>
  byChild: ChoresByChild
  completedCount: number
  totalCount: number
  completeChore: (assignmentId: number) => Promise<void>
}

function groupByChild(assignments: ChoreAssignment[] | null): ChoresByChild {
  if (!assignments) return {}
  const groups: ChoresByChild = {}
  for (const a of assignments) {
    if (!groups[a.child_name]) groups[a.child_name] = []
    groups[a.child_name].push(a)
  }
  return groups
}

export function useChores(): ChoresData {
  const assignments = usePolling<ChoreAssignment[]>({
    fetcher: () => {
      const today = new Date()
      const dateStr = today.toISOString().split('T')[0]
      return choresApi.getAssignments(dateStr)
    },
    intervalMs: 60 * 1000,
  })

  const completeChore = useCallback(
    async (assignmentId: number) => {
      const today = new Date().toISOString().split('T')[0]
      await choresApi.completeAssignment(assignmentId, today)
      await assignments.refetch()
    },
    [assignments],
  )

  const byChild = groupByChild(assignments.data)
  const totalCount = assignments.data?.length ?? 0
  const completedCount = assignments.data?.filter((a) => a.completed).length ?? 0

  return { assignments, byChild, completedCount, totalCount, completeChore }
}
