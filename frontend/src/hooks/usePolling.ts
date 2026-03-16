import { useState, useEffect, useCallback, useRef } from 'react'

interface UsePollingOptions<T> {
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

export function usePolling<T>({
  fetcher,
  intervalMs,
  enabled = true,
}: UsePollingOptions<T>): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current()
      setData(result)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    refetch()
    const interval = setInterval(refetch, intervalMs)
    return () => clearInterval(interval)
  }, [enabled, intervalMs, refetch])

  return { data, error, isLoading, refetch }
}
