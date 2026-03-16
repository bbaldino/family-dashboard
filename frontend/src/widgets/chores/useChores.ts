import { useCallback, useState, useEffect, useRef } from 'react'
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
  const polling = usePolling<ChoreAssignment[]>({
    fetcher: () => {
      const today = new Date()
      const dateStr = today.toISOString().split('T')[0]
      return choresApi.getAssignments(dateStr)
    },
    intervalMs: 60 * 1000,
  })

  // Local state that tracks assignments for optimistic updates
  const [localAssignments, setLocalAssignments] = useState<ChoreAssignment[] | null>(null)
  const prevPollingData = useRef<ChoreAssignment[] | null>(null)

  // Sync polling data into local state when it changes
  useEffect(() => {
    if (polling.data !== prevPollingData.current) {
      prevPollingData.current = polling.data
      setLocalAssignments(polling.data)
    }
  }, [polling.data])

  const completeChore = useCallback(
    async (assignmentId: number) => {
      // Snapshot current state for rollback
      const snapshot = localAssignments

      // Optimistically mark as completed
      setLocalAssignments((prev) =>
        prev
          ? prev.map((a) =>
              a.id === assignmentId ? { ...a, completed: true } : a,
            )
          : prev,
      )

      try {
        const today = new Date().toISOString().split('T')[0]
        await choresApi.completeAssignment(assignmentId, today)
        // Refetch to get canonical server state
        await polling.refetch()
      } catch (e) {
        // Revert on failure
        setLocalAssignments(snapshot)
        throw e
      }
    },
    [localAssignments, polling],
  )

  const byChild = groupByChild(localAssignments)
  const totalCount = localAssignments?.length ?? 0
  const completedCount = localAssignments?.filter((a) => a.completed).length ?? 0

  // Expose a combined result that uses local assignments but preserves polling metadata
  const assignments: UsePollingResult<ChoreAssignment[]> = {
    ...polling,
    data: localAssignments,
  }

  return { assignments, byChild, completedCount, totalCount, completeChore }
}
