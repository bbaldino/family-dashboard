import { useQuery } from '@tanstack/react-query'
import { activeScenario } from '@/data/scenario'
import { musicIntegration } from './config'
import { musicTopTracksFixtureFor, musicRecentFixtureFor } from './fixtures'
import type { TopTrack, RecentItem } from './types'

/** The "Frequently Played" list backing the quick-dials screen. */
export function useTopTracks() {
  return useQuery({
    queryKey: ['music', 'top-tracks'],
    queryFn: () => {
      const fixture = musicTopTracksFixtureFor(activeScenario)
      return fixture ? Promise.resolve(fixture) : musicIntegration.api.get<TopTrack[]>('/top-tracks?limit=12')
    },
    refetchInterval: 5 * 60 * 1000,
  })
}

/** The "Recently Played" list backing the quick-dials screen. */
export function useRecentlyPlayed() {
  return useQuery({
    queryKey: ['music', 'recent'],
    queryFn: () => {
      const fixture = musicRecentFixtureFor(activeScenario)
      return fixture ? Promise.resolve(fixture) : musicIntegration.api.get<RecentItem[]>('/recent')
    },
    refetchInterval: 5 * 60 * 1000,
  })
}
