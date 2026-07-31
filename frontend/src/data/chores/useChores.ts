import { useQuery, useQueryClient } from '@tanstack/react-query'
import { choresIntegration } from './config'
import type { TodayResponse } from './types'

export function useChores() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['chores', 'today'],
    queryFn: () => choresIntegration.api!.get<TodayResponse>('/today'),
    refetchInterval: 60 * 1000, // 1 minute
  })

  const refetch = async () => {
    await queryClient.invalidateQueries({ queryKey: ['chores', 'today'] })
  }

  const completeAssignment = async (id: number) => {
    await choresIntegration.api!.post(`/assignments/${id}/complete`, {})
    await refetch()
  }

  const uncompleteAssignment = async (id: number) => {
    await choresIntegration.api!.post(`/assignments/${id}/uncomplete`, {})
    await refetch()
  }

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
