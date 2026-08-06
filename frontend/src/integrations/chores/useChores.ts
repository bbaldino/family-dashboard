import { useQuery, useQueryClient } from '@tanstack/react-query'
import { choresIntegration } from './config'
import type { TodayResponse } from './types'

/**
 * The wall dashboard's today view. Exported because the admin hooks in
 * `useChoreAdmin` write the same underlying rows through different endpoints
 * and have to invalidate this entry too — a parallel key there would leave the
 * kitchen tablet stale until its next poll.
 */
export const TODAY_KEY = ['chores', 'today'] as const

/**
 * Flip one assignment's `completed` in a cached `TodayResponse`, keeping the
 * section header's `completed_count` in step. Returns the input untouched when
 * the assignment is absent or already in the requested state, so a redundant
 * call can't drift the count.
 *
 * The per-person `n/m` needs no handling here: `capChoreGroups` derives its
 * `doneCount` from each assignment's `completed`, so it follows this flip.
 */
export function flipCompleted(
  data: TodayResponse | undefined,
  id: number,
  completed: boolean,
): TodayResponse | undefined {
  if (!data) return data
  let changed = false
  const persons = data.persons.map((p) => ({
    ...p,
    assignments: p.assignments.map((a) => {
      if (a.id !== id || a.completed === completed) return a
      changed = true
      return { ...a, completed }
    }),
  }))
  if (!changed) return data
  return { ...data, persons, completed_count: data.completed_count + (completed ? 1 : -1) }
}

export function useChores() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: TODAY_KEY,
    queryFn: () => choresIntegration.api!.get<TodayResponse>('/today'),
    refetchInterval: 60 * 1000, // 1 minute
  })

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: TODAY_KEY })
  }

  /**
   * Toggle one assignment, flipping the cache first so the checkbox moves on
   * the tap rather than a round trip later — on a wall tablet that delay reads
   * as a dead control.
   *
   * The revert on failure is a surgical inverse flip (`flipCompleted` again,
   * with `completed` negated), not a snapshot restore of the whole
   * `TodayResponse`. A snapshot taken before the POST and written back
   * wholesale would clobber any unrelated change that landed while the
   * request was in flight — another assignment's tap that already succeeded
   * and refetched, or a 60s poll response. The inverse flip only ever touches
   * this one assignment, so it can't step on those.
   *
   * `cancelQueries` runs first so a background poll that's already in flight
   * can't land between the optimistic write and the POST and overwrite it —
   * it's a microtask, not a network round trip, so it doesn't delay the flip.
   *
   * Deliberately does not reject. Call sites are `onClick={() => toggle(id)}`
   * and never await, so rejecting would only produce an unhandled rejection
   * (the exact trap the music transport hit). The revert is the failure
   * signal: the row visibly snaps back. The household column is clipped at
   * `overflow: hidden` with 0.4px to spare, so it has no room for a banner.
   */
  const setCompleted = async (id: number, completed: boolean) => {
    await queryClient.cancelQueries({ queryKey: TODAY_KEY })
    const before = queryClient.getQueryData<TodayResponse>(TODAY_KEY)
    const after = flipCompleted(before, id, completed)
    if (after === before) return // nothing to do; UI already shows the target state
    queryClient.setQueryData(TODAY_KEY, after)
    const action = completed ? 'complete' : 'uncomplete'
    try {
      await choresIntegration.api!.post(`/assignments/${id}/${action}`, {})
      await refetch()
    } catch (err) {
      queryClient.setQueryData<TodayResponse>(TODAY_KEY, (d) => flipCompleted(d, id, !completed))
      console.error(`chores: ${action} ${id} failed`, err)
    }
  }

  const completeAssignment = (id: number) => setCompleted(id, true)
  const uncompleteAssignment = (id: number) => setCompleted(id, false)

  // Deliberately still rejects, unlike the complete/uncomplete pair above:
  // picking is not tap-to-undo, has no optimistic path, and its only callers
  // (MetaChorePicker's button handlers) already `await` it, so there's no
  // unhandled-rejection trap to avoid here. Don't "fix" this to swallow
  // errors too.
  const pickChore = async (assignmentId: number, choreId: number) => {
    await choresIntegration.api!.post(`/assignments/${assignmentId}/pick`, { chore_id: choreId })
    await refetch()
  }

  const clearPick = async (assignmentId: number) => {
    await choresIntegration.api!.post(`/assignments/${assignmentId}/clear-pick`, {})
    await refetch()
  }

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error?.message ?? null,
    refetch,
    completeAssignment,
    uncompleteAssignment,
    pickChore,
    clearPick,
  }
}
