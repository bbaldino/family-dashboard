import { useQuery } from '@tanstack/react-query'
import { musicIntegration } from './config'
import type { TopTrack, RecentItem } from './types'

/** The "Frequently Played" list backing the quick-dials screen. */
export function useTopTracks() {
  return useQuery({
    queryKey: ['music', 'top-tracks'],
    queryFn: () => musicIntegration.api.get<TopTrack[]>('/top-tracks?limit=12'),
    refetchInterval: 5 * 60 * 1000,
  })
}

/** The "Recently Played" list backing the quick-dials screen. */
export function useRecentlyPlayed() {
  return useQuery({
    queryKey: ['music', 'recent'],
    queryFn: () => musicIntegration.api.get<RecentItem[]>('/recent'),
    refetchInterval: 5 * 60 * 1000,
  })
}
