import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { sportsIntegration } from './config'
import type { GamesResponse } from './types'

const SPORTS_GAMES_KEY = ['sports', 'games'] as const

export function useSportsGames() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: SPORTS_GAMES_KEY,
    queryFn: () => sportsIntegration.api.get<GamesResponse>('/games'),
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.hasLive) {
        return 30 * 1000
      }
      return 15 * 60 * 1000
    },
  })

  // SSE: nudge a refetch whenever the backend tells us something meaningful
  // happened (e.g. a scheduled game start time was reached). Polling above
  // stays as a fallback in case SSE isn't connected.
  useEffect(() => {
    const source = new EventSource('/api/sports/events')
    const handleKick = () => {
      queryClient.invalidateQueries({ queryKey: SPORTS_GAMES_KEY })
    }
    source.addEventListener('kick', handleKick)
    source.onerror = () => {
      // The browser auto-reconnects EventSource on transient failures. Nothing
      // to do here besides letting it try again — log so we can see it during
      // dev.
      if (source.readyState === EventSource.CLOSED) {
        console.warn('Sports SSE closed; relying on polling until reconnect')
      }
    }
    return () => {
      source.removeEventListener('kick', handleKick)
      source.close()
    }
  }, [queryClient])

  return query
}
