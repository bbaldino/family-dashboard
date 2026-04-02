import { useQuery } from '@tanstack/react-query'
import { useRef } from 'react'

interface UsePollingOptions<T> {
  queryKey?: string[]
  fetcher: () => Promise<T>
  intervalMs: number
  enabled?: boolean
}

export interface UsePollingResult<T> {
  data: T | null
  error: string | null
  isLoading: boolean
  refetch: () => Promise<void>
}

let queryKeyCounter = 0

export function usePolling<T>({
  queryKey,
  fetcher,
  intervalMs,
  enabled = true,
}: UsePollingOptions<T>): UsePollingResult<T> {
  // Stable ref for the fetcher to avoid query key changes
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  // Auto-generate a stable query key if none provided
  const autoKeyRef = useRef<string[] | undefined>(undefined)
  if (!autoKeyRef.current) {
    autoKeyRef.current = queryKey ?? [`polling-${++queryKeyCounter}`]
  }
  const key = queryKey ?? autoKeyRef.current

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetcherRef.current(),
    refetchInterval: intervalMs,
    enabled,
  })

  return {
    data: query.data ?? null,
    error: query.error ? (query.error instanceof Error ? query.error.message : 'Unknown error') : null,
    isLoading: query.isLoading,
    refetch: async () => { await query.refetch() },
  }
}
